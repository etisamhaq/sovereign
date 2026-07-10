"""
Unit tests for rewards.views — RewardBalanceView, CoinTransactionListView,
RedemptionTierListView, RedeemView, AchievementListView, LeaderboardView,
ReferralStatsView, ValidateReferralCodeView.
"""
import pytest
from rest_framework import status
from django.contrib.auth import get_user_model
from rewards.models import (
    CoinBalance, CoinTransaction, RedemptionTier,
    UserAchievement, UserStreak, Referral,
)
from payments.models import UsageQuota

User = get_user_model()


@pytest.mark.django_db
class TestRewardBalanceView:
    url = "/api/rewards/balance/"

    def test_get_balance(self, auth_client, coin_balance, user_streak):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert "balance" in resp.data
        assert "current_streak" in resp.data

    def test_get_balance_creates_missing(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["balance"] == 0

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCoinTransactionListView:
    url = "/api/rewards/transactions/"

    def test_list_transactions(self, auth_client, user, coin_balance):
        CoinTransaction.objects.create(
            user=user, amount=10, transaction_type="earned",
            reason="tool_use", balance_after=510,
        )
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestRedemptionTierListView:
    url = "/api/rewards/tiers/"

    def test_list_active_tiers(self, auth_client, redemption_tier):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 1

    def test_inactive_tiers_excluded(self, auth_client, db):
        RedemptionTier.objects.create(
            name="Inactive", coin_cost=999, bonus_credits=1, is_active=False,
        )
        resp = auth_client.get(self.url)
        names = [t["name"] for t in resp.data]
        assert "Inactive" not in names


@pytest.mark.django_db
class TestRedeemView:
    url = "/api/rewards/redeem/"

    def test_redeem_success(self, auth_client, user, coin_balance, redemption_tier):
        UsageQuota.objects.create(user=user)
        resp = auth_client.post(self.url, {"tier_id": str(redemption_tier.id)})
        assert resp.status_code == status.HTTP_200_OK
        assert "bonus_credits" in resp.data

    def test_redeem_insufficient_coins(self, auth_client, user, redemption_tier):
        CoinBalance.objects.create(user=user, balance=1)
        resp = auth_client.post(self.url, {"tier_id": str(redemption_tier.id)})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_redeem_invalid_tier(self, auth_client):
        import uuid
        resp = auth_client.post(self.url, {"tier_id": str(uuid.uuid4())})
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated(self, api_client, redemption_tier):
        resp = api_client.post(self.url, {"tier_id": str(redemption_tier.id)})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAchievementListView:
    url = "/api/rewards/achievements/"

    def test_list_achievements(self, auth_client, user):
        UserAchievement.objects.create(
            user=user, achievement_type="milestone_50", coins_awarded=200,
        )
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) >= 1

    def test_empty_achievements(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data) == 0


@pytest.mark.django_db
class TestLeaderboardView:
    url = "/api/rewards/leaderboard/"

    def test_leaderboard(self, auth_client, coin_balance):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(resp.data, list)

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestReferralStatsView:
    url = "/api/rewards/referrals/"

    def test_referral_stats(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert "referral_code" in resp.data
        assert "total_referrals" in resp.data

    def test_unauthenticated(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestValidateReferralCodeView:
    url = "/api/rewards/referrals/validate/"

    def test_valid_code(self, api_client, user):
        resp = api_client.post(self.url, {"referral_code": user.referral_code})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["valid"] is True

    def test_invalid_code(self, api_client):
        resp = api_client.post(self.url, {"referral_code": "INVALID123"})
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        assert resp.data["valid"] is False


@pytest.mark.django_db
class TestReferralLeaderboardView:
    url = "/api/rewards/referrals/leaderboard/"

    def test_leaderboard(self, auth_client):
        resp = auth_client.get(self.url)
        assert resp.status_code == status.HTTP_200_OK
        assert isinstance(resp.data, list)
