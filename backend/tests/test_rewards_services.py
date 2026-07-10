"""
Unit tests for rewards.services — RewardService.
"""
import pytest
from datetime import date, timedelta
from django.contrib.auth import get_user_model
from rewards.services import (
    RewardService,
    COINS_PER_TOOL_USE, COINS_FIRST_DAILY_USE, COINS_NEW_TOOL,
    COINS_SIGNUP_BONUS, COINS_REFERRER_BONUS, COINS_REFEREE_BONUS,
    CREDITS_REFERRER_BONUS, CREDITS_REFEREE_BONUS,
)
from rewards.models import CoinBalance, CoinTransaction, UserStreak, UserAchievement, Referral
from payments.models import UsageQuota

User = get_user_model()


@pytest.mark.django_db
class TestGrantSignupBonus:
    def test_signup_bonus_creates_balance(self, user):
        bonus = RewardService.grant_signup_bonus(user)
        assert bonus == COINS_SIGNUP_BONUS
        cb = CoinBalance.objects.get(user=user)
        assert cb.balance == COINS_SIGNUP_BONUS
        assert cb.total_earned == COINS_SIGNUP_BONUS

    def test_signup_bonus_creates_transaction(self, user):
        RewardService.grant_signup_bonus(user)
        tx = CoinTransaction.objects.filter(user=user, reason="signup_bonus")
        assert tx.exists()
        assert tx.first().amount == COINS_SIGNUP_BONUS


@pytest.mark.django_db
class TestAwardCoinsForToolUse:
    def test_base_coins_awarded(self, user, tool):
        from tools.models import ToolUsage
        usage = ToolUsage.objects.create(
            user=user, tool=tool,
            input_data={"text": "hi"}, output_data={"result": "hello"},
        )
        result = RewardService.award_coins_for_tool_use(user, tool, usage.id)
        assert result["coins_earned"] >= COINS_PER_TOOL_USE
        assert result["new_balance"] > 0
        assert len(result["awards"]) >= 1

    def test_first_daily_use_bonus(self, user, tool):
        """First use of the day should grant daily bonus."""
        from tools.models import ToolUsage
        usage = ToolUsage.objects.create(
            user=user, tool=tool,
            input_data={}, output_data={},
        )
        result = RewardService.award_coins_for_tool_use(user, tool, usage.id)
        reasons = [a["reason"] for a in result["awards"]]
        assert "first_daily_use" in reasons

    def test_new_tool_bonus(self, user, tool):
        """First time using a tool should grant new tool bonus."""
        from tools.models import ToolUsage
        usage = ToolUsage.objects.create(
            user=user, tool=tool,
            input_data={}, output_data={},
        )
        result = RewardService.award_coins_for_tool_use(user, tool, usage.id)
        reasons = [a["reason"] for a in result["awards"]]
        assert "new_tool" in reasons

    def test_no_new_tool_bonus_on_repeat_use(self, user, tool):
        """Second use of same tool should NOT give new tool bonus."""
        from tools.models import ToolUsage
        # First use
        ToolUsage.objects.create(
            user=user, tool=tool,
            input_data={}, output_data={},
        )
        # Second use
        usage2 = ToolUsage.objects.create(
            user=user, tool=tool,
            input_data={}, output_data={},
        )
        # Need a fresh streak to avoid duplicate daily bonus issue
        streak = UserStreak.objects.create(
            user=user, current_streak=1,
            last_active_date=date.today(),
        )
        CoinBalance.objects.create(user=user)

        result = RewardService.award_coins_for_tool_use(user, tool, usage2.id)
        reasons = [a["reason"] for a in result["awards"]]
        assert "new_tool" not in reasons


@pytest.mark.django_db
class TestRedeem:
    def test_redeem_success(self, user, coin_balance, redemption_tier):
        UsageQuota.objects.create(user=user)
        success, msg = RewardService.redeem(user, redemption_tier)
        assert success is True
        coin_balance.refresh_from_db()
        assert coin_balance.balance == 500 - redemption_tier.coin_cost

    def test_redeem_insufficient_coins(self, user, redemption_tier):
        CoinBalance.objects.create(user=user, balance=10)
        success, msg = RewardService.redeem(user, redemption_tier)
        assert success is False
        assert "Not enough" in msg

    def test_redeem_adds_bonus_credits(self, user, coin_balance, redemption_tier):
        quota = UsageQuota.objects.create(user=user, bonus_credits=0)
        RewardService.redeem(user, redemption_tier)
        quota.refresh_from_db()
        assert quota.bonus_credits == redemption_tier.bonus_credits


@pytest.mark.django_db
class TestProcessReferral:
    def test_process_referral_success(self, user, second_user):
        UsageQuota.objects.create(user=user)
        UsageQuota.objects.create(user=second_user)
        result = RewardService.process_referral(user, second_user)
        assert result is not None
        assert result["referrer_coins"] == COINS_REFERRER_BONUS
        assert result["referee_coins"] == COINS_REFEREE_BONUS
        assert Referral.objects.filter(referrer=user, referee=second_user).exists()

    def test_self_referral_returns_none(self, user):
        result = RewardService.process_referral(user, user)
        assert result is None

    def test_duplicate_referral_returns_none(self, user, second_user):
        UsageQuota.objects.create(user=user)
        UsageQuota.objects.create(user=second_user)
        RewardService.process_referral(user, second_user)
        result = RewardService.process_referral(user, second_user)
        assert result is None

    def test_referral_creates_transaction(self, user, second_user):
        UsageQuota.objects.create(user=user)
        UsageQuota.objects.create(user=second_user)
        RewardService.process_referral(user, second_user)
        referrer_txns = CoinTransaction.objects.filter(user=user, reason="referral_bonus")
        referee_txns = CoinTransaction.objects.filter(user=second_user, reason="referee_bonus")
        assert referrer_txns.exists()
        assert referee_txns.exists()


@pytest.mark.django_db
class TestGetSummary:
    def test_summary_structure(self, user, coin_balance, user_streak):
        summary = RewardService.get_summary(user)
        assert "balance" in summary
        assert "total_earned" in summary
        assert "current_streak" in summary
        assert "achievements" in summary
        assert summary["balance"] == 500

    def test_summary_creates_missing_records(self, second_user):
        summary = RewardService.get_summary(second_user)
        assert summary["balance"] == 0
        assert summary["current_streak"] == 0


@pytest.mark.django_db
class TestGetReferralStats:
    def test_referral_stats_structure(self, user):
        stats = RewardService.get_referral_stats(user)
        assert "referral_code" in stats
        assert "total_referrals" in stats
        assert "milestones" in stats
        assert "rewards_per_referral" in stats

    def test_referral_stats_with_referrals(self, user, second_user):
        UsageQuota.objects.create(user=user)
        UsageQuota.objects.create(user=second_user)
        RewardService.process_referral(user, second_user)
        stats = RewardService.get_referral_stats(user)
        assert stats["total_referrals"] == 1


@pytest.mark.django_db
class TestStreakUpdate:
    def test_streak_increments_on_consecutive_day(self, user):
        cb = CoinBalance.objects.create(user=user)
        streak = UserStreak.objects.create(
            user=user, current_streak=3,
            last_active_date=date.today() - timedelta(days=1),
        )
        awards = RewardService._update_streak(user, streak, date.today(), cb)
        assert streak.current_streak == 4

    def test_streak_resets_on_gap(self, user):
        cb = CoinBalance.objects.create(user=user)
        streak = UserStreak.objects.create(
            user=user, current_streak=5,
            last_active_date=date.today() - timedelta(days=3),
        )
        RewardService._update_streak(user, streak, date.today(), cb)
        assert streak.current_streak == 1

    def test_streak_no_change_same_day(self, user):
        cb = CoinBalance.objects.create(user=user)
        streak = UserStreak.objects.create(
            user=user, current_streak=5,
            last_active_date=date.today(),
        )
        RewardService._update_streak(user, streak, date.today(), cb)
        assert streak.current_streak == 5
