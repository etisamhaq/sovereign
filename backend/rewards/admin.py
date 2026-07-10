from django.contrib import admin
from .models import CoinBalance, CoinTransaction, UserStreak, UserAchievement, RedemptionTier, Referral


@admin.register(CoinBalance)
class CoinBalanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance', 'total_earned', 'total_redeemed', 'updated_at')
    search_fields = ('user__email',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'transaction_type', 'reason', 'balance_after', 'created_at')
    list_filter = ('transaction_type', 'reason')
    search_fields = ('user__email', 'description')
    readonly_fields = ('id', 'created_at')
    ordering = ('-created_at',)


@admin.register(UserStreak)
class UserStreakAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_streak', 'longest_streak', 'last_active_date')
    search_fields = ('user__email',)
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement_type', 'coins_awarded', 'achieved_at')
    list_filter = ('achievement_type',)
    search_fields = ('user__email',)
    readonly_fields = ('id', 'achieved_at')


@admin.register(RedemptionTier)
class RedemptionTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'coin_cost', 'bonus_credits', 'icon', 'is_active', 'sort_order')
    list_editable = ('coin_cost', 'bonus_credits', 'is_active', 'sort_order')
    ordering = ('sort_order',)


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ('referrer', 'referee', 'status', 'referrer_coins_awarded', 'referrer_bonus_credits', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('referrer__email', 'referee__email')
    readonly_fields = ('id', 'created_at')
    ordering = ('-created_at',)
