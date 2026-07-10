"""
Unit tests for rewards.models — CoinBalance, CoinTransaction, UserStreak,
UserAchievement, RedemptionTier, Referral.
"""
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rewards.models import (
    CoinBalance, CoinTransaction, UserStreak,
    UserAchievement, RedemptionTier, Referral,
)

User = get_user_model()


@pytest.mark.django_db
class TestCoinBalance:
    def test_str(self, coin_balance, user):
        s = str(coin_balance)
        assert user.email in s
        assert "500" in s

    def test_defaults(self, user):
        cb = CoinBalance.objects.create(user=user)
        assert cb.balance == 0
        assert cb.total_earned == 0
        assert cb.total_redeemed == 0


@pytest.mark.django_db
class TestCoinTransaction:
    def test_str(self, user, coin_balance):
        tx = CoinTransaction.objects.create(
            user=user, amount=10,
            transaction_type="earned", reason="tool_use",
            description="Used Paraphraser", balance_after=510,
        )
        assert "+10" in str(tx)
        assert user.email in str(tx)

    def test_negative_amount(self, user, coin_balance):
        tx = CoinTransaction.objects.create(
            user=user, amount=-100,
            transaction_type="redeemed", reason="redemption",
            balance_after=400,
        )
        assert tx.amount == -100


@pytest.mark.django_db
class TestUserStreak:
    def test_str(self, user_streak, user):
        s = str(user_streak)
        assert user.email in s
        assert "5" in s

    def test_defaults(self, user):
        streak = UserStreak.objects.create(user=user)
        assert streak.current_streak == 0
        assert streak.longest_streak == 0
        assert streak.last_active_date is None


@pytest.mark.django_db
class TestUserAchievement:
    def test_str(self, user):
        ach = UserAchievement.objects.create(
            user=user, achievement_type="milestone_50", coins_awarded=200,
        )
        assert user.email in str(ach)

    def test_unique_together(self, user):
        UserAchievement.objects.create(
            user=user, achievement_type="milestone_50", coins_awarded=200,
        )
        with pytest.raises(Exception):
            UserAchievement.objects.create(
                user=user, achievement_type="milestone_50", coins_awarded=200,
            )


@pytest.mark.django_db
class TestRedemptionTier:
    def test_str(self, redemption_tier):
        s = str(redemption_tier)
        assert "Small Pack" in s
        assert "100" in s

    def test_fields(self, redemption_tier):
        assert redemption_tier.coin_cost == 100
        assert redemption_tier.bonus_credits == 5
        assert redemption_tier.is_active is True


@pytest.mark.django_db
class TestReferral:
    def test_str(self, user, second_user):
        ref = Referral.objects.create(
            referrer=user, referee=second_user,
            status="completed",
            referrer_coins_awarded=100,
            referee_coins_awarded=25,
        )
        assert user.email in str(ref)
        assert second_user.email in str(ref)

    def test_unique_together(self, user, second_user):
        Referral.objects.create(referrer=user, referee=second_user)
        with pytest.raises(Exception):
            Referral.objects.create(referrer=user, referee=second_user)
