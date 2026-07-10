from rest_framework import serializers
from .models import CoinBalance, CoinTransaction, UserStreak, UserAchievement, RedemptionTier, Referral


class CoinBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoinBalance
        fields = ['balance', 'total_earned', 'total_redeemed']
        read_only_fields = fields


class CoinTransactionSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)

    class Meta:
        model = CoinTransaction
        fields = [
            'id', 'amount', 'transaction_type', 'reason',
            'reason_display', 'description', 'balance_after', 'created_at'
        ]
        read_only_fields = fields


class UserStreakSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserStreak
        fields = ['current_streak', 'longest_streak', 'last_active_date']
        read_only_fields = fields


class UserAchievementSerializer(serializers.ModelSerializer):
    achievement_display = serializers.CharField(source='get_achievement_type_display', read_only=True)

    class Meta:
        model = UserAchievement
        fields = ['achievement_type', 'achievement_display', 'coins_awarded', 'achieved_at']
        read_only_fields = fields


class RedemptionTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedemptionTier
        fields = ['id', 'name', 'description', 'coin_cost', 'bonus_credits', 'icon', 'is_active']
        read_only_fields = fields


class RedeemRequestSerializer(serializers.Serializer):
    tier_id = serializers.UUIDField()


class RewardSummarySerializer(serializers.Serializer):
    """Combined summary returned by GET /rewards/balance/"""
    balance = serializers.IntegerField()
    total_earned = serializers.IntegerField()
    total_redeemed = serializers.IntegerField()
    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    last_active_date = serializers.CharField(allow_null=True)
    achievements = UserAchievementSerializer(many=True)


class ReferralSerializer(serializers.ModelSerializer):
    referee_name = serializers.SerializerMethodField()
    referee_email = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = [
            'id', 'referee_name', 'referee_email', 'status',
            'referrer_coins_awarded', 'referee_coins_awarded',
            'referrer_bonus_credits', 'referee_bonus_credits',
            'created_at'
        ]
        read_only_fields = fields

    def get_referee_name(self, obj):
        return obj.referee.get_short_name()

    def get_referee_email(self, obj):
        email = obj.referee.email
        parts = email.split('@')
        return f"{parts[0][:2]}***@{parts[1]}"


class ValidateReferralCodeSerializer(serializers.Serializer):
    referral_code = serializers.CharField(max_length=12)
