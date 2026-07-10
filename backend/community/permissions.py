from rest_framework import permissions


class IsAuthorOrReadOnly(permissions.BasePermission):
    """Allow read access to anyone, write access only to the author."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user


class IsPostAuthor(permissions.BasePermission):
    """Only the original post author can perform this action."""

    def has_object_permission(self, request, view, obj):
        # obj could be a Reply — check the parent post's author
        if hasattr(obj, 'post'):
            return obj.post.author == request.user
        return obj.author == request.user


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read access to anyone, write access only to admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class IsStaffUser(permissions.BasePermission):
    """Staff (is_staff) may access moderation and community admin actions."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )
