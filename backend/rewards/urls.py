from django.urls import path
from . import views

app_name = 'rewards'

urlpatterns = [
    path('balance/', views.RewardBalanceView.as_view(), name='balance'),
    path('transactions/', views.CoinTransactionListView.as_view(), name='transactions'),
    path('tiers/', views.RedemptionTierListView.as_view(), name='tiers'),
    path('redeem/', views.RedeemView.as_view(), name='redeem'),
    path('achievements/', views.AchievementListView.as_view(), name='achievements'),
    path('leaderboard/', views.LeaderboardView.as_view(), name='leaderboard'),

    # Referral program
    path('referrals/', views.ReferralStatsView.as_view(), name='referral-stats'),
    path('referrals/history/', views.ReferralHistoryView.as_view(), name='referral-history'),
    path('referrals/validate/', views.ValidateReferralCodeView.as_view(), name='referral-validate'),
    path('referrals/leaderboard/', views.ReferralLeaderboardView.as_view(), name='referral-leaderboard'),
]
