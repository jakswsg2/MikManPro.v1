from django.contrib import admin
from .models import (
    Permission, Role, RolePermission, UserRoleAssignment,
    PermissionGroup, GroupPermission, UserGroupAssignment,
    UserPermissionOverride, ResourcePermissionOverride
)

class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'scope_level', 'is_system', 'is_assignable', 'created_at')
    list_filter = ('scope_level', 'is_system', 'is_assignable')
    search_fields = ('code', 'name', 'description')
    inlines = [RolePermissionInline]

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'resource_type', 'action', 'requires_scope', 'is_system')
    list_filter = ('category', 'resource_type', 'action', 'requires_scope', 'is_system')
    search_fields = ('code', 'name', 'description')

@admin.register(UserRoleAssignment)
class UserRoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'tenant', 'site', 'assigned_at', 'is_active', 'expires_at')
    list_filter = ('role', 'is_active', 'tenant', 'site')
    search_fields = ('user__username', 'user__lounge_id', 'role__code')

class GroupPermissionInline(admin.TabularInline):
    model = GroupPermission
    extra = 1

@admin.register(PermissionGroup)
class PermissionGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'priority', 'tenant', 'role', 'is_system')
    list_filter = ('is_system', 'tenant', 'role')
    search_fields = ('name', 'code', 'description')
    inlines = [GroupPermissionInline]

@admin.register(UserGroupAssignment)
class UserGroupAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'group', 'tenant', 'site', 'is_active')
    list_filter = ('group', 'is_active', 'tenant', 'site')
    search_fields = ('user__username', 'user__lounge_id', 'group__name')

@admin.register(UserPermissionOverride)
class UserPermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ('user', 'permission', 'is_granted', 'reason', 'expires_at')
    list_filter = ('is_granted', 'permission__category')
    search_fields = ('user__username', 'permission__code', 'reason')

@admin.register(ResourcePermissionOverride)
class ResourcePermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ('user', 'resource_type', 'resource_id', 'permission', 'is_granted', 'reason')
    list_filter = ('resource_type', 'is_granted', 'permission__category')
    search_fields = ('user__username', 'resource_id', 'permission__code', 'reason')
