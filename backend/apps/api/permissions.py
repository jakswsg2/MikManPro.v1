from rest_framework.permissions import BasePermission
from apps.permissions.engine import PermissionEngine

class HasLoungePermission(BasePermission):
    """
    Checks whether the requesting user has the required permission code
    according to the Smart Lounge PermissionEngine.
    """
    required_permission = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusers and staff bypass
        if request.user.is_superuser:
            return True

        perm_code = getattr(view, 'required_permission', self.required_permission)
        if not perm_code:
            return True

        return PermissionEngine.has_permission(request.user, perm_code)

class IsLoungeAdmin(BasePermission):
    """Restricts access to Smart Lounge administrators."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.is_staff or
            request.user.is_superuser or
            PermissionEngine.has_permission(request.user, 'admin.access')
        )
