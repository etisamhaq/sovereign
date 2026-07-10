from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_auth(request):
    """Test endpoint to verify authentication"""
    return Response({
        'authenticated': True,
        'user': {
            'id': request.user.id,
            'email': request.user.email,
            'is_pro': getattr(request.user, 'is_pro', False),
            'subscription_tier': getattr(request.user, 'subscription_tier', 'free')
        },
        'auth_header': request.META.get('HTTP_AUTHORIZATION', 'Not provided'),
        'has_token': bool(request.auth)
    })