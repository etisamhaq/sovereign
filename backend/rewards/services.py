"""
Reward Service — central logic for the coin-based reward system.

All coin operations flow through this service to keep business logic
out of views and models.
"""
import logging
from datetime import date, timedelta
from django.db import transaction
from django.db.models import Count

from .models import CoinBalance, CoinTransaction, UserStreak, UserAchievement, Referral

logger = logging.getLogger(__name__)

# ── Coin amounts ──────────────────────────────────────────────────
COINS_PER_TOOL_USE = 10
COINS_FIRST_DAILY_USE = 20
COINS_NEW_TOOL = 30
COINS_SIGNUP_BONUS = 50

# Referral rewards
COINS_REFERRER_BONUS = 100      # Referrer gets 100 coins per referral
COINS_REFEREE_BONUS = 25        # New user gets 25 coins for using a ref link
CREDITS_REFERRER_BONUS = 5      # Referrer gets 5 bonus tool uses
CREDITS_REFEREE_BONUS = 2       # New user gets 2 bonus tool uses

REFERRAL_MILESTONES = {
    3:  {'coins': 50,   'type': 'referral_3',  'desc': 'Referred 3 friends!'},
    5:  {'coins': 150,  'type': 'referral_5',  'desc': 'Referred 5 friends!'},
    10: {'coins': 500,  'type': 'referral_10', 'desc': 'Referred 10 friends!', 'pro_days': 7},
    25: {'coins': 1000, 'type': 'referral_25', 'desc': 'Referred 25 friends!', 'pro_days': 30},
}

STREAK_BONUS = {
    3: 5,     # 3-day streak  → +5 per day
    7: 10,    # 7-day streak  → +10 per day
    14: 15,   # 14-day streak → +15 per day
    30: 25,   # 30-day streak → +25 per day
}

MILESTONES = {
    50:  {'coins': 200,  'type': 'milestone_50',  'desc': 'Reached 50 total uses!'},
    100: {'coins': 500,  'type': 'milestone_100', 'desc': 'Reached 100 total uses!'},
    500: {'coins': 1500, 'type': 'milestone_500', 'desc': 'Reached 500 total uses!'},
}

STREAK_ACHIEVEMENTS = {
    7:  {'type': 'streak_7',  'coins': 100, 'desc': '7-day streak achieved!'},
    30: {'type': 'streak_30', 'coins': 500, 'desc': '30-day streak achieved!'},
}


class RewardService:
    """Stateless service — every method takes user explicitly."""

    # ── Public API ────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def award_coins_for_tool_use(user, tool, usage_id=None):
        """
        Called after a successful tool use.  Awards base coins plus
        any applicable bonuses (first daily use, new tool, streak, milestone).
        Returns a summary dict the API can include in its response.
        """
        balance = RewardService._get_or_create_balance(user)
        streak = RewardService._get_or_create_streak(user)
        today = date.today()
        awards = []

        # 1. Base coins for tool use
        RewardService._credit(user, balance, COINS_PER_TOOL_USE,
                              'earned', 'tool_use',
                              f'Used {tool.name}', usage_id)
        awards.append({'reason': 'tool_use', 'coins': COINS_PER_TOOL_USE,
                       'label': 'Tool Usage'})

        # 2. First tool use of the day?
        if streak.last_active_date != today:
            RewardService._credit(user, balance, COINS_FIRST_DAILY_USE,
                                  'bonus', 'first_daily_use',
                                  'First tool use of the day')
            awards.append({'reason': 'first_daily_use', 'coins': COINS_FIRST_DAILY_USE,
                           'label': 'First Use Today'})

        # 3. Streak update
        streak_awards = RewardService._update_streak(user, streak, today, balance)
        awards.extend(streak_awards)

        # 4. New tool?  (user has never used this tool before)
        from tools.models import ToolUsage
        prior = ToolUsage.objects.filter(user=user, tool=tool).exclude(
            id=usage_id).exists()
        if not prior:
            RewardService._credit(user, balance, COINS_NEW_TOOL,
                                  'bonus', 'new_tool',
                                  f'First time using {tool.name}')
            awards.append({'reason': 'new_tool', 'coins': COINS_NEW_TOOL,
                           'label': f'New Tool: {tool.name}'})

        # 5. Milestone check
        milestone_awards = RewardService._check_milestones(user, balance)
        awards.extend(milestone_awards)

        total_earned = sum(a['coins'] for a in awards)
        return {
            'coins_earned': total_earned,
            'new_balance': balance.balance,
            'awards': awards,
            'streak': streak.current_streak,
        }

    @staticmethod
    @transaction.atomic
    def redeem(user, tier):
        """
        Redeem coins for bonus credits.
        Returns (success: bool, message: str).
        """
        balance = RewardService._get_or_create_balance(user)

        if balance.balance < tier.coin_cost:
            return False, f'Not enough coins. Need {tier.coin_cost}, have {balance.balance}.'

        # Deduct coins
        balance.balance -= tier.coin_cost
        balance.total_redeemed += tier.coin_cost
        balance.save(update_fields=['balance', 'total_redeemed', 'updated_at'])

        CoinTransaction.objects.create(
            user=user,
            amount=-tier.coin_cost,
            transaction_type='redeemed',
            reason='redemption',
            description=f'Redeemed {tier.name} ({tier.bonus_credits} credits)',
            reference_id=tier.id,
            balance_after=balance.balance,
        )

        # Add bonus credits to UsageQuota
        from payments.models import UsageQuota
        quota, _ = UsageQuota.objects.get_or_create(user=user)
        quota.bonus_credits += tier.bonus_credits
        quota.save(update_fields=['bonus_credits'])

        return True, f'Redeemed! {tier.bonus_credits} bonus credits added.'

    @staticmethod
    def grant_signup_bonus(user):
        """Give new users a welcome bonus."""
        balance = RewardService._get_or_create_balance(user)
        RewardService._credit(user, balance, COINS_SIGNUP_BONUS,
                              'bonus', 'signup_bonus',
                              'Welcome bonus for signing up!')
        return COINS_SIGNUP_BONUS

    @staticmethod
    @transaction.atomic
    def process_referral(referrer, referee):
        """
        Process a referral after a new user signs up with a referral code.
        Awards coins and bonus credits to both referrer and referee.
        Returns a summary dict.
        """
        # Prevent self-referral or duplicate referral
        if referrer.pk == referee.pk:
            return None
        if Referral.objects.filter(referrer=referrer, referee=referee).exists():
            return None

        referrer_balance = RewardService._get_or_create_balance(referrer)
        referee_balance = RewardService._get_or_create_balance(referee)

        # Award coins to referrer
        RewardService._credit(
            referrer, referrer_balance, COINS_REFERRER_BONUS,
            'bonus', 'referral_bonus',
            f'Referral bonus — {referee.get_short_name()} joined!'
        )

        # Award coins to referee
        RewardService._credit(
            referee, referee_balance, COINS_REFEREE_BONUS,
            'bonus', 'referee_bonus',
            f'Welcome bonus — referred by {referrer.get_short_name()}'
        )

        # Award bonus tool credits
        from payments.models import UsageQuota
        referrer_quota, _ = UsageQuota.objects.get_or_create(user=referrer)
        referrer_quota.add_bonus_credits(CREDITS_REFERRER_BONUS)

        referee_quota, _ = UsageQuota.objects.get_or_create(user=referee)
        referee_quota.add_bonus_credits(CREDITS_REFEREE_BONUS)

        # Create referral record
        referral = Referral.objects.create(
            referrer=referrer,
            referee=referee,
            status='completed',
            referrer_coins_awarded=COINS_REFERRER_BONUS,
            referee_coins_awarded=COINS_REFEREE_BONUS,
            referrer_bonus_credits=CREDITS_REFERRER_BONUS,
            referee_bonus_credits=CREDITS_REFEREE_BONUS,
        )

        # Check referral milestones
        milestone_awards = RewardService._check_referral_milestones(referrer, referrer_balance)

        return {
            'referral_id': str(referral.id),
            'referrer_coins': COINS_REFERRER_BONUS,
            'referee_coins': COINS_REFEREE_BONUS,
            'referrer_credits': CREDITS_REFERRER_BONUS,
            'referee_credits': CREDITS_REFEREE_BONUS,
            'milestone_awards': milestone_awards,
        }

    @staticmethod
    def get_referral_stats(user):
        """Get comprehensive referral stats for a user."""
        referrals = Referral.objects.filter(referrer=user)
        total_referrals = referrals.count()
        total_coins_earned = sum(r.referrer_coins_awarded for r in referrals)
        total_credits_earned = sum(r.referrer_bonus_credits for r in referrals)

        # Milestone coins earned
        milestone_coins = UserAchievement.objects.filter(
            user=user,
            achievement_type__startswith='referral_'
        ).values_list('coins_awarded', flat=True)
        total_milestone_coins = sum(milestone_coins)

        # Next milestone
        next_milestone = None
        for threshold in sorted(REFERRAL_MILESTONES.keys()):
            if total_referrals < threshold:
                next_milestone = {
                    'target': threshold,
                    'current': total_referrals,
                    'remaining': threshold - total_referrals,
                    'reward_coins': REFERRAL_MILESTONES[threshold]['coins'],
                    'reward_pro_days': REFERRAL_MILESTONES[threshold].get('pro_days', 0),
                }
                break

        # Recent referrals (use fresh queryset — the original was evaluated by sum() above)
        recent = (
            Referral.objects.filter(referrer=user)
            .select_related('referee')
            .order_by('-created_at')[:10]
            .values(
                'referee__email', 'referee__username', 'referee__first_name',
                'referrer_coins_awarded', 'referrer_bonus_credits', 'created_at'
            )
        )
        recent_list = []
        for r in recent:
            name = r['referee__first_name'] or r['referee__username'] or r['referee__email'].split('@')[0]
            recent_list.append({
                'name': name,
                'coins_earned': r['referrer_coins_awarded'],
                'credits_earned': r['referrer_bonus_credits'],
                'date': r['created_at'].isoformat(),
            })

        # Milestones achieved
        achieved = list(
            UserAchievement.objects.filter(
                user=user, achievement_type__startswith='referral_'
            ).values('achievement_type', 'coins_awarded', 'achieved_at')
        )

        # All milestones with status
        all_milestones = []
        for threshold, info in sorted(REFERRAL_MILESTONES.items()):
            is_achieved = any(a['achievement_type'] == info['type'] for a in achieved)
            all_milestones.append({
                'target': threshold,
                'type': info['type'],
                'description': info['desc'],
                'coins': info['coins'],
                'pro_days': info.get('pro_days', 0),
                'achieved': is_achieved,
            })

        return {
            'referral_code': user.referral_code,
            'total_referrals': total_referrals,
            'total_coins_earned': total_coins_earned + total_milestone_coins,
            'total_credits_earned': total_credits_earned,
            'next_milestone': next_milestone,
            'recent_referrals': recent_list,
            'milestones': all_milestones,
            'rewards_per_referral': {
                'referrer_coins': COINS_REFERRER_BONUS,
                'referrer_credits': CREDITS_REFERRER_BONUS,
                'referee_coins': COINS_REFEREE_BONUS,
                'referee_credits': CREDITS_REFEREE_BONUS,
            },
        }

    @staticmethod
    def _check_referral_milestones(user, balance):
        """Check and award referral milestone achievements."""
        awards = []
        total_referrals = Referral.objects.filter(referrer=user).count()

        for threshold, info in REFERRAL_MILESTONES.items():
            if total_referrals >= threshold:
                if not UserAchievement.objects.filter(
                    user=user, achievement_type=info['type']
                ).exists():
                    UserAchievement.objects.create(
                        user=user,
                        achievement_type=info['type'],
                        coins_awarded=info['coins'],
                    )
                    RewardService._credit(
                        user, balance, info['coins'],
                        'bonus', 'referral_milestone',
                        info['desc']
                    )
                    awards.append({
                        'reason': 'referral_milestone',
                        'coins': info['coins'],
                        'label': info['desc'],
                    })

                    # Award Pro days if applicable
                    pro_days = info.get('pro_days', 0)
                    if pro_days > 0:
                        RewardService._grant_pro_days(user, pro_days)
                        awards.append({
                            'reason': 'pro_days',
                            'days': pro_days,
                            'label': f'{pro_days} Pro days awarded!',
                        })

        return awards

    @staticmethod
    def _grant_pro_days(user, days):
        """Grant Pro subscription days to a user."""
        from django.utils import timezone as tz
        from datetime import timedelta as td
        now = tz.now()

        if user.subscription_end_date and user.subscription_end_date > now:
            # Extend existing subscription
            user.subscription_end_date += td(days=days)
        else:
            # Start new Pro period
            user.subscription_tier = 'pro'
            user.subscription_end_date = now + td(days=days)

        user.save(update_fields=['subscription_tier', 'subscription_end_date'])

    @staticmethod
    def get_summary(user):
        """Return a complete reward summary for the user."""
        balance = RewardService._get_or_create_balance(user)
        streak = RewardService._get_or_create_streak(user)
        achievements = list(
            UserAchievement.objects.filter(user=user)
            .values('achievement_type', 'coins_awarded', 'achieved_at')
        )
        return {
            'balance': balance.balance,
            'total_earned': balance.total_earned,
            'total_redeemed': balance.total_redeemed,
            'current_streak': streak.current_streak,
            'longest_streak': streak.longest_streak,
            'last_active_date': str(streak.last_active_date) if streak.last_active_date else None,
            'achievements': achievements,
        }

    # ── Internal helpers ──────────────────────────────────────────

    @staticmethod
    def _get_or_create_balance(user):
        obj, _ = CoinBalance.objects.get_or_create(user=user)
        return obj

    @staticmethod
    def _get_or_create_streak(user):
        obj, _ = UserStreak.objects.get_or_create(user=user)
        return obj

    @staticmethod
    def _credit(user, balance, amount, txn_type, reason, description='', reference_id=None):
        """Add coins and record the transaction."""
        balance.balance += amount
        balance.total_earned += amount
        balance.save(update_fields=['balance', 'total_earned', 'updated_at'])

        CoinTransaction.objects.create(
            user=user,
            amount=amount,
            transaction_type=txn_type,
            reason=reason,
            description=description,
            reference_id=reference_id,
            balance_after=balance.balance,
        )

    @staticmethod
    def _update_streak(user, streak, today, balance):
        """Update the user's daily streak and award streak bonuses."""
        awards = []

        if streak.last_active_date is None:
            # First ever activity
            streak.current_streak = 1
        elif streak.last_active_date == today:
            # Already active today — no streak change
            streak.save()
            return awards
        elif streak.last_active_date == today - timedelta(days=1):
            # Consecutive day!
            streak.current_streak += 1
        else:
            # Streak broken
            streak.current_streak = 1

        streak.last_active_date = today
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak
        streak.save()

        # Award streak bonus based on highest applicable tier
        bonus = 0
        for threshold, coins in sorted(STREAK_BONUS.items(), reverse=True):
            if streak.current_streak >= threshold:
                bonus = coins
                break

        if bonus > 0:
            RewardService._credit(user, balance, bonus,
                                  'bonus', 'streak_bonus',
                                  f'{streak.current_streak}-day streak bonus')
            awards.append({
                'reason': 'streak_bonus', 'coins': bonus,
                'label': f'{streak.current_streak}-Day Streak'
            })

        # One-time streak achievements
        for threshold, info in STREAK_ACHIEVEMENTS.items():
            if streak.current_streak >= threshold:
                if not UserAchievement.objects.filter(
                    user=user, achievement_type=info['type']
                ).exists():
                    UserAchievement.objects.create(
                        user=user,
                        achievement_type=info['type'],
                        coins_awarded=info['coins'],
                    )
                    RewardService._credit(user, balance, info['coins'],
                                          'bonus', 'milestone',
                                          info['desc'])
                    awards.append({
                        'reason': 'milestone', 'coins': info['coins'],
                        'label': info['desc']
                    })

        return awards

    @staticmethod
    def _check_milestones(user, balance):
        """Check usage-based milestones."""
        awards = []
        total = user.total_usage_count

        for threshold, info in MILESTONES.items():
            if total >= threshold:
                if not UserAchievement.objects.filter(
                    user=user, achievement_type=info['type']
                ).exists():
                    UserAchievement.objects.create(
                        user=user,
                        achievement_type=info['type'],
                        coins_awarded=info['coins'],
                    )
                    RewardService._credit(user, balance, info['coins'],
                                          'bonus', 'milestone',
                                          info['desc'])
                    awards.append({
                        'reason': 'milestone', 'coins': info['coins'],
                        'label': info['desc']
                    })

        return awards
