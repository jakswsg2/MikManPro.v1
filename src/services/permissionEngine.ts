import { LoungeUser, MediaItem, Profile, UserPermissionOverride } from '../types';
import { simulateDecision59, evaluateSmartContentAccess } from '../data/phase3Data';
import { EntitlementEngine, SubscriptionEngine } from './billingEngine';

export class PermissionEngineClient {
  /**
   * Resolves the full set of effective permission codes for a Lounge user.
   * Considers active profile, entitlements from active subscription, system defaults, and user permission overrides.
   */
  static getEffectivePermissions(
    user: LoungeUser,
    profile?: Profile,
    overrides?: UserPermissionOverride[]
  ): Set<string> {
    if (!user || !user.is_active) {
      return new Set();
    }

    if (user.is_superuser) {
      return new Set([
        'content.movies.view',
        'content.movies.play',
        'content.movies.download',
        'content.series.view',
        'content.series.play',
        'content.series.download',
        'content.kids.view',
        'content.kids.play',
        'content.sports.view',
        'content.sports.play',
        'content.premium.view',
        'content.premium.play',
        'content.download',
        'content.download.unlimited',
        'feat.lan_chat',
        'feat.custom_requests',
        'features.favorites',
        'features.rating',
        'features.watchlist',
        'features.external_player',
        'features.casting',
        'features.download',
        'admin.access',
        'admin.panel.access',
        'admin.users.view',
        'admin.servers.view',
        'admin.mikrotik.manage',
        'admin.radius.manage',
        'admin.permissions.manage',
        'admin.billing.manage',
        'system.settings.manage',
        'system.audit.view',
        '*',
      ]);
    }

    const effective = new Set<string>();

    // 1. Phase 7: Compute dynamic entitlements from active subscription & add-ons
    const entitlements = EntitlementEngine.computeEntitlements(user.id);
    for (const [code, val] of Object.entries(entitlements)) {
      if (val === true) {
        effective.add(code);
      }
    }

    // 2. Profile default permissions
    const activeProfile = profile || user.active_profile;
    if (activeProfile && Array.isArray(activeProfile.permissions)) {
      activeProfile.permissions.forEach((perm) => effective.add(perm));
    }

    // 3. Individual user overrides (highest precedence)
    const activeOverrides = overrides || user.overrides || [];
    activeOverrides.forEach((override) => {
      if (override.is_granted) {
        effective.add(override.permission_code);
      } else {
        effective.delete(override.permission_code);
      }
    });

    return effective;
  }

  /**
   * Evaluates whether the user holds a specific permission code.
   */
  static hasPermission(
    user: LoungeUser,
    permissionCode: string,
    profile?: Profile,
    overrides?: UserPermissionOverride[]
  ): boolean {
    if (user.is_superuser) return true;
    const permissions = this.getEffectivePermissions(user, profile, overrides);

    if (permissions.has('*') || permissions.has(permissionCode)) {
      return true;
    }

    // Check wildcard match
    const parts = permissionCode.split('.');
    for (let i = 1; i <= parts.length; i++) {
      const wildcard = parts.slice(0, i).join('.') + '.*';
      if (permissions.has(wildcard)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Decision 59 Multi-Layer Diagnostic Trace
   */
  static simulateEvaluation(user: LoungeUser, permissionCode: string, resourceType?: string, resourceId?: string) {
    return simulateDecision59(user, permissionCode, resourceType, resourceId);
  }

  /**
   * Decision 38 Smart Content Access Matrix
   */
  static evaluateContentAccess(user: LoungeUser, item: MediaItem) {
    return evaluateSmartContentAccess(user, item);
  }

  /**
   * Alias for evaluateContentAccess
   */
  static evaluateMediaAccess(user: LoungeUser, item: MediaItem) {
    return evaluateSmartContentAccess(user, item);
  }

  /**
   * Determines if a media item is viewable/streamable for the given user.
   */
  static canAccessMediaItem(
    user: LoungeUser,
    item: MediaItem,
    profile?: Profile,
    overrides?: UserPermissionOverride[]
  ): { allowed: boolean; reason?: string } {
    if (user.is_superuser) {
      return { allowed: true };
    }

    // Phase 7: Subscription check
    const sub = SubscriptionEngine.getActiveSubscription(user.id);
    if (!sub) {
      return {
        allowed: false,
        reason: 'لا يوجد لديك اشتراك نشط في الاستراحة. يرجى تفعيل كرت أو اختيار باقة للاستمرار.',
      };
    }

    if (sub.status === 'SUSPENDED') {
      return {
        allowed: false,
        reason: `تم تعليق اشتراكك إدارياً: ${sub.suspend_reason || 'يرجى مراجعة إدارة الاستراحة'}.`,
      };
    }

    if (sub.status === 'EXPIRED') {
      return {
        allowed: false,
        reason: 'انتهت فترة اشتراكك في الاستراحة. يرجى شحن وتجديد الباقة للمشاهدة.',
      };
    }

    const evaluation = evaluateSmartContentAccess(user, item);
    if (!evaluation.can_view) {
      return {
        allowed: false,
        reason: evaluation.reasons[0] || 'غير مصرح لك بعرض هذه المادة في باقتك الحالية',
      };
    }

    return { allowed: true };
  }

  /**
   * Checks if user has permission to download media locally via LAN.
   */
  static canDownload(
    user: LoungeUser,
    profile?: Profile,
    overrides?: UserPermissionOverride[]
  ): boolean {
    return this.hasPermission(user, 'content.download', profile, overrides) ||
           this.hasPermission(user, 'content.movies.download', profile, overrides) ||
           this.hasPermission(user, 'features.download', profile, overrides);
  }
}
