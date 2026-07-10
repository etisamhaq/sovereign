from rest_framework import permissions
from payments.models import UsageQuota


class HasUsageQuota(permissions.BasePermission):
    """Check if user has available usage quota"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Get or create usage quota
        quota, _ = UsageQuota.objects.get_or_create(user=request.user)
        
        # Check if user has available credits
        if not quota.has_credits():
            view.permission_denied(
                request,
                message="You have reached your usage limit. Please upgrade to Pro for more credits."
            )
            return False
        
        return True


class IsPremiumUser(permissions.BasePermission):
    """Check if user has premium subscription"""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return request.user.is_pro