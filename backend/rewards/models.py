from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid

User = get_user_model()


class CoinBalance(models.Model):
    """Tracks a user's current coin balance and lifetime stats."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='coin_balance')

    balance = models.IntegerField(default=0, help_text="Current spendable coins")
    total_earned = models.IntegerField(default=0, help_text="Lifetime coins earned")
    total_redeemed = models.IntegerField(default=0, help_text="Lifetime coins spent")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'coin_balances'

    def __str__(self):
        return f"{self.user.email} — {self.balance} coins"


class CoinTransaction(models.Model):
    """Immutable audit log of every coin change."""
    TRANSACTION_TYPES = (
        ('earned', 'Earned'),
        ('bonus', 'Bonus'),
        ('redeemed', 'Redeemed'),
        ('expired', 'Expired'),
    )

    REASON_CHOICES = (
        ('tool_use', 'Tool Usage'),
        ('first_daily_use', 'First Tool Use of the Day'),
        ('new_tool', 'Tried a New Tool'),
        ('streak_bonus', 'Daily Streak Bonus'),
        ('milestone', 'Milestone Achievement'),
        ('redemption', 'Redeemed for Credits'),
        ('signup_bonus', 'Signup Bonus'),
        ('referral_bonus', 'Referral Bonus'),
        ('referee_bonus', 'Referee Welcome Bonus'),
        ('referral_milestone', 'Referral Milestone'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coin_transactions')

    amount = models.IntegerField(help_text="Positive = earned, negative = spent")
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    description = models.CharField(max_length=255, blank=True)

    # Optional reference to the tool usage that triggered this
    reference_id = models.UUIDField(null=True, blank=True, help_text="ToolUsage ID or RedemptionTier ID")

    balance_after = models.IntegerField(help_text="Balance after this transaction")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'coin_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type']),
        ]

    def __str__(self):
        return f"{self.user.email} {self.amount:+d} ({self.reason})"


class UserStreak(models.Model):
    """Tracks daily login/usage streaks."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak')

    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_streaks'

    def __str__(self):
        return f"{self.user.email} — {self.current_streak} day streak"


class UserAchievement(models.Model):
    """Records one-time milestone achievements."""
    ACHIEVEMENT_TYPES = (
        ('milestone_50', '50 Total Uses'),
        ('milestone_100', '100 Total Uses'),
        ('milestone_500', '500 Total Uses'),
        ('streak_7', '7-Day Streak'),
        ('streak_30', '30-Day Streak'),
        ('all_tools', 'Tried All Tools'),
        ('referral_3', '3 Referrals'),
        ('referral_5', '5 Referrals'),
        ('referral_10', '10 Referrals'),
        ('referral_25', '25 Referrals'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')

    achievement_type = models.CharField(max_length=30, choices=ACHIEVEMENT_TYPES)
    coins_awarded = models.IntegerField(default=0)
    achieved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_achievements'
        unique_together = ('user', 'achievement_type')
        ordering = ['-achieved_at']

    def __str__(self):
        return f"{self.user.email} — {self.get_achievement_type_display()}"


class RedemptionTier(models.Model):
    """Configurable tiers for redeeming coins into bonus credits."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    coin_cost = models.IntegerField(help_text="Coins required to redeem")
    bonus_credits = models.IntegerField(help_text="Bonus usage credits granted")
    icon = models.CharField(max_length=10, default='🎁')
    is_active = models.BooleanField(default=True)

    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'redemption_tiers'
        ordering = ['sort_order', 'coin_cost']

    def __str__(self):
        return f"{self.name} — {self.coin_cost} coins → {self.bonus_credits} credits"


class Referral(models.Model):
    """Tracks each successful referral event."""
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referrals_made')
    referee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='referred_through')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    referrer_coins_awarded = models.IntegerField(default=0)
    referee_coins_awarded = models.IntegerField(default=0)
    referrer_bonus_credits = models.IntegerField(default=0)
    referee_bonus_credits = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'referrals'
        ordering = ['-created_at']
        unique_together = ('referrer', 'referee')
        indexes = [
            models.Index(fields=['referrer', '-created_at']),
        ]

    def __str__(self):
        return f"{self.referrer.email} → {self.referee.email} ({self.status})"
