import json
from typing import Set, Dict, Any, Optional, List, Tuple
from django.utils import timezone
from django.core.cache import cache

class PermissionEngine:
    """
    Smart Lounge Enterprise Hybrid Authorization Engine.
    Implements Architectural Decisions 12, 37, 38, and 59:
    Hierarchy: Global -> Tenant -> Site -> Group -> User -> Profile -> Resource
    Principle: Deny by Default with Full Auditability & Redis Invalidation.
    """

    CACHE_TTL_SECONDS = 3600  # 1 hour
    CACHE_KEY_PREFIX = "lounge:perms"

    @classmethod
    def _build_cache_key(cls, user_id: str, tenant_id: Optional[str] = None, site_id: Optional[str] = None) -> str:
        t_part = tenant_id or "notenant"
        s_part = site_id or "nosite"
        return f"{cls.CACHE_KEY_PREFIX}:{user_id}:{t_part}:{s_part}"

    @classmethod
    def invalidate_cache(cls, user_id: Optional[str] = None, tenant_id: Optional[str] = None, site_id: Optional[str] = None):
        """Invalidates Redis cache entries when roles, groups, or overrides change"""
        if user_id:
            # Invalidate specific user cache
            if tenant_id and site_id:
                cache.delete(cls._build_cache_key(user_id, tenant_id, site_id))
            else:
                # Invalidate common permutations or pattern
                cache.delete(cls._build_cache_key(user_id, None, None))
                cache.delete(cls._build_cache_key(user_id, tenant_id, None))
                cache.delete(cls._build_cache_key(user_id, None, site_id))
                if tenant_id and site_id:
                    cache.delete(cls._build_cache_key(user_id, tenant_id, site_id))

    @classmethod
    def get_effective_permissions(
        cls,
        user,
        tenant=None,
        site=None,
        use_cache: bool = True
    ) -> Set[str]:
        """
        Resolves the comprehensive set of effective permissions for a user
        in the specified Tenant and Site context following Decision 59.
        """
        if not user or not user.is_authenticated:
            return set()

        if user.is_superuser:
            from apps.permissions.models import Permission
            all_codes = set(Permission.objects.values_list('code', flat=True))
            return all_codes | {'*'}

        user_id_str = str(user.id)
        tenant_id_str = str(tenant.id) if tenant else None
        site_id_str = str(site.id) if site else None
        cache_key = cls._build_cache_key(user_id_str, tenant_id_str, site_id_str)

        if use_cache:
            cached = cache.get(cache_key)
            if cached is not None:
                try:
                    return set(json.loads(cached))
                except Exception:
                    pass

        # Evaluate across the Decision 59 Hierarchy
        # Start with empty set (Deny by Default)
        allowed_permissions: Set[str] = set()
        denied_permissions: Set[str] = set()
        now = timezone.now()

        # -------------------------------------------------------------
        # Tier 6: Profile (Baseline)
        # -------------------------------------------------------------
        active_profile = getattr(user, 'active_profile', None)
        if active_profile and isinstance(active_profile.permissions, list):
            for code in active_profile.permissions:
                allowed_permissions.add(str(code))

        # -------------------------------------------------------------
        # Tier 5: User Individual Overrides (Decision 12)
        # -------------------------------------------------------------
        from apps.permissions.models import UserPermissionOverride
        user_overrides = UserPermissionOverride.objects.filter(
            user=user
        ).select_related('permission')

        for override in user_overrides:
            if override.expires_at and override.expires_at < now:
                continue
            perm_code = override.permission.code
            if override.is_granted:
                allowed_permissions.add(perm_code)
                denied_permissions.discard(perm_code)
            else:
                denied_permissions.add(perm_code)
                allowed_permissions.discard(perm_code)

        # -------------------------------------------------------------
        # Tier 4: Permission Groups (Ordered by priority descending)
        # -------------------------------------------------------------
        from apps.permissions.models import UserGroupAssignment, GroupPermission
        group_assignments = UserGroupAssignment.objects.filter(
            user=user,
            is_active=True
        ).select_related('group').order_by('-group__priority')

        for assignment in group_assignments:
            # Check tenant/site scope of group membership if applicable
            if assignment.tenant and tenant and assignment.tenant != tenant:
                continue
            if assignment.site and site and assignment.site != site:
                continue

            grp = assignment.group
            group_perms = GroupPermission.objects.filter(group=grp).select_related('permission')
            for gp in group_perms:
                code = gp.permission.code
                if gp.effect == GroupPermission.Effect.ALLOW:
                    # Only add if not explicitly denied by a higher or override layer
                    if code not in denied_permissions:
                        allowed_permissions.add(code)
                elif gp.effect == GroupPermission.Effect.DENY:
                    denied_permissions.add(code)
                    allowed_permissions.discard(code)

        # -------------------------------------------------------------
        # Tier 3 & 2 & 1: Roles (Site -> Tenant -> Global)
        # -------------------------------------------------------------
        from apps.permissions.models import UserRoleAssignment, RolePermission, Role
        role_assignments = UserRoleAssignment.objects.filter(
            user=user,
            is_active=True
        ).select_related('role')

        for ra in role_assignments:
            if ra.expires_at and ra.expires_at < now:
                continue

            r = ra.role
            # Scope validation
            if r.scope_level == Role.ScopeLevel.GLOBAL:
                pass  # Applies globally
            elif r.scope_level == Role.ScopeLevel.TENANT:
                if tenant and ra.tenant != tenant:
                    continue
            elif r.scope_level == Role.ScopeLevel.SITE:
                if site and ra.site != site:
                    continue
            else:
                continue

            role_perms = RolePermission.objects.filter(role=r).select_related('permission')
            for rp in role_perms:
                code = rp.permission.code
                if rp.effect == RolePermission.Effect.ALLOW:
                    if code not in denied_permissions:
                        allowed_permissions.add(code)
                elif rp.effect == RolePermission.Effect.DENY:
                    denied_permissions.add(code)
                    allowed_permissions.discard(code)

        # Cache resolution
        try:
            cache.set(cache_key, json.dumps(list(allowed_permissions)), timeout=cls.CACHE_TTL_SECONDS)
        except Exception:
            pass

        return allowed_permissions

    @classmethod
    def has_permission(
        cls,
        user,
        permission_code: str,
        tenant=None,
        site=None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None
    ) -> bool:
        """
        Evaluates whether a user has a specific permission in a context.
        Checks Wildcard matching (content.*) and Resource-Level Overrides.
        """
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        # Check Resource-Level Override first if resource is provided (Decision 37)
        if resource_type and resource_id:
            from apps.permissions.models import ResourcePermissionOverride
            now = timezone.now()
            res_override = ResourcePermissionOverride.objects.filter(
                user=user,
                resource_type=resource_type,
                resource_id=str(resource_id),
                permission__code=permission_code
            ).first()

            if res_override:
                if not (res_override.expires_at and res_override.expires_at < now):
                    return res_override.is_granted

        effective_permissions = cls.get_effective_permissions(user, tenant=tenant, site=site)

        if '*' in effective_permissions or permission_code in effective_permissions:
            return True

        # Wildcard evaluation (e.g., content.movies.* or content.*)
        parts = permission_code.split('.')
        for i in range(1, len(parts)):
            wildcard = '.'.join(parts[:i]) + '.*'
            if wildcard in effective_permissions:
                return True

        return False

    @classmethod
    def simulate_permission_evaluation(
        cls,
        user,
        permission_code: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        tenant=None,
        site=None
    ) -> Dict[str, Any]:
        """
        Decision 59 Diagnostic Simulator:
        Traces step-by-step resolution through Global, Tenant, Site, Group, User, and Profile tiers.
        """
        steps = []
        final_decision = False
        decision_layer = "Deny by Default"
        reason = "لم يتم العثور على أي قاعدة تمنح الصلاحية صراحة (Deny by Default)"

        if not user or not user.is_authenticated:
            return {
                'decision': False,
                'decision_layer': 'Authentication',
                'reason': 'المستخدم غير مسجل الدخول أو غير صالح',
                'steps': [],
            }

        # Step 1: Superuser Check
        if user.is_superuser:
            steps.append({
                'layer': '1. Global (Super Admin)',
                'result': 'ALLOW',
                'detail': 'المستخدم يتمتع بصلاحيات Superuser العالمية المطلقة',
                'active': True,
            })
            return {
                'decision': True,
                'decision_layer': 'Global Super Admin',
                'reason': 'منح تلقائي بحكم رتبة مدير عام المنظومة',
                'steps': steps,
            }

        # Step 2: Global Roles
        from apps.permissions.models import UserRoleAssignment, Role, RolePermission
        global_ras = UserRoleAssignment.objects.filter(
            user=user,
            is_active=True,
            role__scope_level=Role.ScopeLevel.GLOBAL
        ).select_related('role')

        for gra in global_ras:
            rp = RolePermission.objects.filter(role=gra.role, permission__code=permission_code).first()
            if rp:
                steps.append({
                    'layer': f'1. Global Role: {gra.role.name}',
                    'result': rp.effect,
                    'detail': f"الدور العالمي {gra.role.code} يحدد الأثر {rp.effect}",
                    'active': True,
                })
                if rp.effect == 'ALLOW':
                    final_decision = True
                    decision_layer = f"Global Role ({gra.role.code})"
                    reason = f"ممنوح بواسطة الدور العالمي {gra.role.name}"

        # Step 3: Tenant Roles
        tenant_ras = UserRoleAssignment.objects.filter(
            user=user,
            is_active=True,
            role__scope_level=Role.ScopeLevel.TENANT
        ).select_related('role', 'tenant')

        for tra in tenant_ras:
            if tenant and tra.tenant != tenant:
                steps.append({
                    'layer': f'2. Tenant Role: {tra.role.name}',
                    'result': 'SKIPPED',
                    'detail': f"الدور ينتمي للمستأجر {tra.tenant.name} وليس المستأجر الحالي",
                    'active': False,
                })
                continue
            rp = RolePermission.objects.filter(role=tra.role, permission__code=permission_code).first()
            if rp:
                steps.append({
                    'layer': f'2. Tenant Role: {tra.role.name}',
                    'result': rp.effect,
                    'detail': f"الدور {tra.role.code} على مستوى المستأجر يحدد الأثر {rp.effect}",
                    'active': True,
                })
                if rp.effect == 'ALLOW':
                    final_decision = True
                    decision_layer = f"Tenant Role ({tra.role.code})"
                    reason = f"ممنوح بواسطة دور المستأجر {tra.role.name}"
                elif rp.effect == 'DENY':
                    final_decision = False
                    decision_layer = f"Tenant Role ({tra.role.code})"
                    reason = f"حظر صريح بواسطة دور المستأجر {tra.role.name}"

        # Step 4: Site Roles
        site_ras = UserRoleAssignment.objects.filter(
            user=user,
            is_active=True,
            role__scope_level=Role.ScopeLevel.SITE
        ).select_related('role', 'site')

        for sra in site_ras:
            if site and sra.site != site:
                steps.append({
                    'layer': f'3. Site Role: {sra.role.name}',
                    'result': 'SKIPPED',
                    'detail': f"الدور ينتمي للموقع {sra.site.name} وليس الموقع الحالي",
                    'active': False,
                })
                continue
            rp = RolePermission.objects.filter(role=sra.role, permission__code=permission_code).first()
            if rp:
                steps.append({
                    'layer': f'3. Site Role: {sra.role.name}',
                    'result': rp.effect,
                    'detail': f"الدور {sra.role.code} على مستوى الفرع يحدد الأثر {rp.effect}",
                    'active': True,
                })
                if rp.effect == 'ALLOW':
                    final_decision = True
                    decision_layer = f"Site Role ({sra.role.code})"
                    reason = f"ممنوح بواسطة دور الفرع {sra.role.name}"
                elif rp.effect == 'DENY':
                    final_decision = False
                    decision_layer = f"Site Role ({sra.role.code})"
                    reason = f"حظر صريح بواسطة دور الفرع {sra.role.name}"

        # Step 5: Groups
        from apps.permissions.models import UserGroupAssignment, GroupPermission
        group_assignments = UserGroupAssignment.objects.filter(
            user=user,
            is_active=True
        ).select_related('group').order_by('-group__priority')

        for ga in group_assignments:
            gp = GroupPermission.objects.filter(group=ga.group, permission__code=permission_code).first()
            if gp:
                steps.append({
                    'layer': f'4. Group: {ga.group.name} (Priority {ga.group.priority})',
                    'result': gp.effect,
                    'detail': f"المجموعة تحدد الأثر {gp.effect}",
                    'active': True,
                })
                if gp.effect == 'ALLOW':
                    final_decision = True
                    decision_layer = f"Group ({ga.group.name})"
                    reason = f"ممنوح عبر عضوية المجموعة {ga.group.name}"
                elif gp.effect == 'DENY':
                    final_decision = False
                    decision_layer = f"Group ({ga.group.name})"
                    reason = f"حظر صريح من المجموعة {ga.group.name}"

        # Step 6: User Individual Override (Decision 12)
        from apps.permissions.models import UserPermissionOverride
        user_override = UserPermissionOverride.objects.filter(
            user=user,
            permission__code=permission_code
        ).first()

        if user_override:
            effect = "ALLOW" if user_override.is_granted else "DENY"
            steps.append({
                'layer': '5. User Individual Override',
                'result': effect,
                'detail': f"استثناء فردي مباشر: {user_override.reason or 'بدون سبب معلن'}",
                'active': True,
            })
            final_decision = user_override.is_granted
            decision_layer = "Individual Override"
            reason = f"استثناء فردي مباشر للمستخدم ({effect}): {user_override.reason or 'طلب استثنائي'}"

        # Step 7: Profile (Baseline)
        active_profile = getattr(user, 'active_profile', None)
        if active_profile and isinstance(active_profile.permissions, list):
            in_profile = permission_code in active_profile.permissions
            steps.append({
                'layer': f'6. Profile: {active_profile.name}',
                'result': 'ALLOW' if in_profile else 'DENY (ABSENT)',
                'detail': f"البروفايل يحتوي على {len(active_profile.permissions)} صلاحية أساسية",
                'active': in_profile,
            })
            if in_profile and decision_layer == "Deny by Default":
                final_decision = True
                decision_layer = f"Profile ({active_profile.name})"
                reason = f"ممنوح افتراضياً ضمن صلاحيات بروفايل المستخدم ({active_profile.name})"

        # Step 8: Resource-Level Override (if requested)
        if resource_type and resource_id:
            from apps.permissions.models import ResourcePermissionOverride
            res_ov = ResourcePermissionOverride.objects.filter(
                user=user,
                resource_type=resource_type,
                resource_id=str(resource_id),
                permission__code=permission_code
            ).first()
            if res_ov:
                res_eff = "ALLOW" if res_ov.is_granted else "DENY"
                steps.append({
                    'layer': f'7. Resource Override: {resource_type}#{resource_id}',
                    'result': res_eff,
                    'detail': f"استثناء مخصص على هذا المورد بعينه: {res_ov.reason or 'تخصيص مباشر'}",
                    'active': True,
                })
                final_decision = res_ov.is_granted
                decision_layer = f"Resource Override ({resource_type})"
                reason = f"قرار نهائي على مستوى المورد {resource_type} #{resource_id}: {res_eff}"

        return {
            'decision': final_decision,
            'decision_layer': decision_layer,
            'reason': reason,
            'permission_code': permission_code,
            'user_lounge_id': getattr(user, 'lounge_id', 'unknown'),
            'steps': steps,
        }
