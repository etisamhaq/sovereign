from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model

from .models import CoinTransaction, RedemptionTier, UserAchievement, Referral
from .serializers import (
    CoinTransactionSerializer,
    RedemptionTierSerializer,
    UserAchievementSerializer,
    RedeemRequestSerializer,
    ReferralSerializer,
    ValidateReferralCodeSerializer,
)
from .services import RewardService

User = get_user_model()


class SmallPagination(PageNumberPagination):
    page_size = 20


class RewardBalanceView(generics.GenericAPIView):
    """GET /api/rewards/balance/ — full reward summary."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        summary = RewardService.get_summary(request.user)
        return Response(summary)


class CoinTransactionListView(generics.ListAPIView):
    """GET /api/rewards/transactions/ — paginated coin history."""
    serializer_class = CoinTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SmallPagination

    def get_queryset(self):
        return CoinTransaction.objects.filter(user=self.request.user)


class RedemptionTierListView(generics.ListAPIView):
    """GET /api/rewards/tiers/ — available redemption options."""
    serializer_class = RedemptionTierSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return RedemptionTier.objects.filter(is_active=True)


class RedeemView(generics.GenericAPIView):
    """POST /api/rewards/redeem/ — exchange coins for bonus credits."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RedeemRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tier_id = serializer.validated_data['tier_id']
        try:
            tier = RedemptionTier.objects.get(id=tier_id, is_active=True)
        except RedemptionTier.DoesNotExist:
            return Response(
                {'error': 'Redemption tier not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        success, message = RewardService.redeem(request.user, tier)
        if not success:
            return Response(
                {'error': message},
                status=status.HTTP_400_BAD_REQUEST
            )

        summary = RewardService.get_summary(request.user)
        return Response({
            'message': message,
            'bonus_credits': tier.bonus_credits,
            **summary,
        })


class AchievementListView(generics.ListAPIView):
    """GET /api/rewards/achievements/ — user's achievements."""
    serializer_class = UserAchievementSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return UserAchievement.objects.filter(user=self.request.user)


class LeaderboardView(generics.GenericAPIView):
    """GET /api/rewards/leaderboard/ — top coin earners."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import CoinBalance
        top = (
            CoinBalance.objects
            .select_related('user')
            .order_by('-total_earned')[:10]
        )
        data = [
            {
                'rank': i + 1,
                'username': cb.user.get_short_name(),
                'total_earned': cb.total_earned,
                'current_streak': getattr(
                    getattr(cb.user, 'streak', None), 'current_streak', 0
                ),
            }
            for i, cb in enumerate(top)
        ]
        return Response(data)


class ReferralStatsView(generics.GenericAPIView):
    """GET /api/rewards/referrals/ — full referral stats for the authenticated user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats = RewardService.get_referral_stats(request.user)
        return Response(stats)


class ReferralHistoryView(generics.ListAPIView):
    """GET /api/rewards/referrals/history/ — paginated referral history."""
    serializer_class = ReferralSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SmallPagination

    def get_queryset(self):
        return Referral.objects.filter(referrer=self.request.user).select_related('referee')


class ValidateReferralCodeView(generics.GenericAPIView):
    """POST /api/rewards/referrals/validate/ — validate a referral code (public)."""
    permission_classes = [permissions.AllowAny]
    serializer_class = ValidateReferralCodeSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['referral_code'].upper().strip()
        try:
            referrer = User.objects.get(referral_code=code)
            return Response({
                'valid': True,
                'referrer_name': referrer.get_short_name(),
                'message': f'Referred by {referrer.get_short_name()}! You\'ll both earn rewards.',
            })
        except User.DoesNotExist:
            return Response({
                'valid': False,
                'message': 'Invalid referral code.',
            }, status=status.HTTP_404_NOT_FOUND)


class ReferralLeaderboardView(generics.GenericAPIView):
    """GET /api/rewards/referrals/leaderboard/ — top referrers."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        top_referrers = (
            User.objects
            .annotate(ref_count=Count('referrals_made'))
            .filter(ref_count__gt=0)
            .order_by('-ref_count')[:10]
        )
        data = [
            {
                'rank': i + 1,
                'username': u.get_short_name(),
                'referral_count': u.ref_count,
            }
            for i, u in enumerate(top_referrers)
        ]
        return Response(data)
