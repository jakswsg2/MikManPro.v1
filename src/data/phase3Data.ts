import {
  Permission, Role, PermissionGroup, UserRoleAssignment,
  ResourcePermissionOverride, PermissionSimulationResult,
  MediaAccessEvaluationResult, LoungeUser, MediaItem
} from '../types';

export const PHASE3_PERMISSIONS: Permission[] = [
  // Content - Movies
  {
    id: 'p-mov-view',
    code: 'content.movies.view',
    name: 'عرض مكتبة الأفلام',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'view',
    description: 'استعراض بوسترات وتفاصيل الأفلام العامة في شبكة الاستراحة',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-mov-play',
    code: 'content.movies.play',
    name: 'تشغيل وبث الأفلام',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث وتشغيل الأفلام بدقة قياسية وفائقة عبر الـ LAN',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-mov-dl',
    code: 'content.movies.download',
    name: 'تحميل الأفلام محلياً',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'download',
    description: 'تحميل ملفات الفيديو إلى جهاز العميل عبر خوادم الاستراحة المحلية',
    is_system: true,
    requires_scope: false
  },

  // Content - Series
  {
    id: 'p-ser-view',
    code: 'content.series.view',
    name: 'عرض مكتبة المسلسلات',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'view',
    description: 'استعراض مواسم وحلقات المسلسلات وتفاصيلها',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-ser-play',
    code: 'content.series.play',
    name: 'تشغيل وبث المسلسلات',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث حلقات المسلسلات عبر الشبكة المحلية بسرعات فائقة',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-ser-dl',
    code: 'content.series.download',
    name: 'تحميل المسلسلات محلياً',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'download',
    description: 'تحميل حلقات المسلسلات للجهاز الشخصي',
    is_system: true,
    requires_scope: false
  },

  // Content - Kids & Family
  {
    id: 'p-kids-view',
    code: 'content.kids.view',
    name: 'عرض محتوى الأطفال',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'view',
    description: 'تصفح رسوم وأفلام الأطفال المفلترة والآمنة 100%',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-kids-play',
    code: 'content.kids.play',
    name: 'تشغيل محتوى الأطفال',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث وتشغيل وسائط الأطفال والعائلة',
    is_system: true,
    requires_scope: false
  },

  // Content - Premium VIP
  {
    id: 'p-prem-view',
    code: 'content.premium.view',
    name: 'عرض المحتوى الحصري VIP',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'view',
    description: 'استعراض أحدث إصدارات السينما VIP 4K HDR',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-prem-play',
    code: 'content.premium.play',
    name: 'تشغيل المحتوى الحصري 4K VIP',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث المحتوى الحصري 4K HDR ومسارات الصوت المحيطي Dolby Atmos',
    is_system: true,
    requires_scope: false
  },

  // Content - Sports
  {
    id: 'p-spo-view',
    code: 'content.sports.view',
    name: 'عرض المحتوى الرياضي',
    category: 'content',
    resource_type: 'MEDIA_ITEM',
    action: 'view',
    description: 'استعراض المباريات والأرشيف الرياضي والملخصات',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-spo-play',
    code: 'content.sports.play',
    name: 'تشغيل وبث المباريات',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث المباريات والملخصات بجودة 60fps عالية',
    is_system: true,
    requires_scope: false
  },

  // Features - User Interaction
  {
    id: 'p-feat-fav',
    code: 'features.favorites',
    name: 'إدارة المفضلة',
    category: 'features',
    resource_type: 'MEDIA_ITEM',
    action: 'edit',
    description: 'إضافة الأعمال لقائمة المفضلة الخاصة بالمستخدم',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-feat-rate',
    code: 'features.rating',
    name: 'تقييم الوسائط',
    category: 'features',
    resource_type: 'MEDIA_ITEM',
    action: 'create',
    description: 'تقييم الأفلام والمسلسلات والمشاركة في استطلاعات الرأي',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-feat-watch',
    code: 'features.watchlist',
    name: 'قائمة المشاهدة لاحقاً',
    category: 'features',
    resource_type: 'MEDIA_ITEM',
    action: 'edit',
    description: 'حفظ العناوين في قائمة الانتظار للمشاهدة اللاحقة',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-feat-req',
    code: 'features.requests',
    name: 'طلب وسائط جديدة',
    category: 'features',
    resource_type: 'MEDIA_ITEM',
    action: 'create',
    description: 'إرسال طلبات إضافة أفلام جديدة لمديري السيرفر',
    is_system: true,
    requires_scope: false
  },

  // Features - Playback Tools
  {
    id: 'p-feat-ext',
    code: 'features.external_player',
    name: 'التشغيل بمشغل خارجي',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'توليد روابط الميديا لفتحها عبر تطبيقات VLC و MX Player',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-feat-cast',
    code: 'features.casting',
    name: 'البث للشاشات (Casting)',
    category: 'playback',
    resource_type: 'MEDIA_ITEM',
    action: 'play',
    description: 'بث الوسائط لشاشات الغرف والصالات عبر Chromecast و AirPlay',
    is_system: true,
    requires_scope: false
  },
  {
    id: 'p-feat-dl',
    code: 'features.download',
    name: 'التحميل فائق السرعة',
    category: 'features',
    resource_type: 'MEDIA_ITEM',
    action: 'download',
    description: 'تحميل مباشر غير مقيد السرعة عبر خطوط الجيجابت',
    is_system: true,
    requires_scope: false
  },

  // Admin - Core Management
  {
    id: 'p-adm-panel',
    code: 'admin.panel.access',
    name: 'دخول لوحة الإدارة',
    category: 'admin',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'الوصول للوحة تحكم إدارة الاستراحة الذكية',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-uview',
    code: 'admin.users.view',
    name: 'استعراض المستخدمين',
    category: 'admin',
    resource_type: 'USER',
    action: 'view',
    description: 'رؤية قائمة المستخدمين والبطاقات والجلسات النشطة',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-ucreate',
    code: 'admin.users.create',
    name: 'إنشاء مستخدمين',
    category: 'admin',
    resource_type: 'USER',
    action: 'create',
    description: 'إصدار بطاقات ومستخدمين جدد يدوياً',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-uedit',
    code: 'admin.users.edit',
    name: 'تعديل المستخدمين',
    category: 'admin',
    resource_type: 'USER',
    action: 'edit',
    description: 'تعديل الصلاحيات والبروفايلات وأوقات الانتهاء',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-udelete',
    code: 'admin.users.delete',
    name: 'حذف وتعليق المستخدمين',
    category: 'admin',
    resource_type: 'USER',
    action: 'delete',
    description: 'حظر الحسابات وفصلها فورياً',
    is_system: true,
    requires_scope: true
  },

  // Admin - Media Servers
  {
    id: 'p-adm-sview',
    code: 'admin.servers.view',
    name: 'استعراض خوادم الوسائط',
    category: 'admin',
    resource_type: 'MEDIA_SERVER',
    action: 'view',
    description: 'فحص خوادم Jellyfin و Emby والمكتبات المرتبطة',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-screate',
    code: 'admin.servers.create',
    name: 'إضافة خادم وسائط',
    category: 'admin',
    resource_type: 'MEDIA_SERVER',
    action: 'create',
    description: 'ربط خادم Jellyfin أو Emby جديد',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-sedit',
    code: 'admin.servers.edit',
    name: 'تعديل خوادم الوسائط',
    category: 'admin',
    resource_type: 'MEDIA_SERVER',
    action: 'edit',
    description: 'تحديث عناوين الشبكة المحلية ومفاتيح API والمزامنة',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-sdel',
    code: 'admin.servers.delete',
    name: 'حذف خادم وسائط',
    category: 'admin',
    resource_type: 'MEDIA_SERVER',
    action: 'delete',
    description: 'إلغاء ربط خادم وسائط وإزالته من الفهرس',
    is_system: true,
    requires_scope: true
  },

  // Admin - Infrastructure Gateways
  {
    id: 'p-adm-mikro',
    code: 'admin.mikrotik.manage',
    name: 'إدارة بوابات MikroTik RouterOS',
    category: 'admin',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'مراقبة راوترات الميكروتيك، فصل المتصلين وضبط قوائم العزل',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-rad',
    code: 'admin.radius.manage',
    name: 'إدارة خوادم RADIUS AAA',
    category: 'admin',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'إدارة التبديل الآلي Failover وخوادم التوثيق الثلاثية',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-adm-perm',
    code: 'admin.permissions.manage',
    name: 'إدارة الصلاحيات والأدوار',
    category: 'admin',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'تعديل مصفوفة الأدوار والمجموعات وتعيينات النطاق',
    is_system: true,
    requires_scope: true
  },

  // System & Auditing
  {
    id: 'p-sys-set',
    code: 'system.settings.manage',
    name: 'إعدادات النظام العامة',
    category: 'system',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'التحكم في إعدادات المنظومة وهوية الاستراحة العامة',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-sys-aud',
    code: 'system.audit.view',
    name: 'استعراض سجلات التدقيق الأمني',
    category: 'system',
    resource_type: 'SYSTEM',
    action: 'view',
    description: 'فحص سجلات الدخول وتدوير التوكنات وأحداث الشبكة الحساسة',
    is_system: true,
    requires_scope: true
  },
  {
    id: 'p-sys-bak',
    code: 'system.backup.manage',
    name: 'إدارة النسخ الاحتياطي',
    category: 'system',
    resource_type: 'SYSTEM',
    action: 'manage',
    description: 'أخذ واسترجاع النسخ الاحتياطية لقواعد البيانات والمكتبات',
    is_system: true,
    requires_scope: true
  },
];

export const PHASE3_ROLES: Role[] = [
  {
    id: 'role-super-admin',
    code: 'SUPER_ADMIN',
    name: 'مدير عام المنظومة (Super Administrator)',
    description: 'صلاحيات مطلقة على كافة المستأجرين والفروع والسيرفرات بدون أي قيود نطاقية',
    is_system: true,
    scope_level: 'GLOBAL',
    is_assignable: false,
    permissions_count: 34,
  },
  {
    id: 'role-tenant-admin',
    code: 'TENANT_ADMIN',
    name: 'مدير المستأجر (Tenant Administrator)',
    description: 'إدارة كاملة للمحتوى والمستخدمين والخوادم ضمن المستأجر المحدد وفروعه التابعة',
    is_system: true,
    scope_level: 'TENANT',
    is_assignable: true,
    permissions_count: 24,
  },
  {
    id: 'role-site-manager',
    code: 'SITE_MANAGER',
    name: 'مدير الفرع / الموقع (Site Manager)',
    description: 'إدارة عمليات الاستراحة المحلية، مستخدمي الهوتسبوت وبوابات الميكروتيك الخاصة بالفرع',
    is_system: true,
    scope_level: 'SITE',
    is_assignable: true,
    permissions_count: 16,
  },
  {
    id: 'role-content-mgr',
    code: 'CONTENT_MANAGER',
    name: 'مدير المحتوى والخوادم (Content Manager)',
    description: 'إدارة خوادم Jellyfin/Emby والمكتبات ومراجعة تصنيفات الأفلام والمسلسلات',
    is_system: true,
    scope_level: 'TENANT',
    is_assignable: true,
    permissions_count: 18,
  },
  {
    id: 'role-support',
    code: 'SUPPORT',
    name: 'مسؤول الدعم الفني (Technical Support)',
    description: 'متابعة بوابات الهوتسبوت والمستخدمين وتشخيص مشاكل الاتصال وتدقيق السجلات',
    is_system: true,
    scope_level: 'SITE',
    is_assignable: true,
    permissions_count: 10,
  },
  {
    id: 'role-user',
    code: 'USER',
    name: 'مستخدم الاستراحة الافتراضي (Standard User)',
    description: 'الدور الافتراضي لكافة رواد الاستراحة للوصول للوسائط وفق البروفايل ومجموعات العضوية',
    is_system: true,
    scope_level: 'USER',
    is_assignable: false,
    permissions_count: 7,
  },
];

export const PHASE3_GROUPS: PermissionGroup[] = [
  {
    id: 'grp-vip',
    code: 'VIP_SUBSCRIBERS',
    name: 'مشتركو صالات الـ VIP (4K & Fast DL)',
    description: 'وصول مباشر لأفلام السينما الحصرية بدقة 4K HDR والتحميل فائق السرعة عبر الشبكة المحلية',
    is_system: true,
    priority: 200,
    permissions: [
      { permission_code: 'content.premium.view', permission_name: 'عرض المحتوى الحصري VIP', effect: 'ALLOW' },
      { permission_code: 'content.premium.play', permission_name: 'تشغيل المحتوى الحصري 4K VIP', effect: 'ALLOW' },
      { permission_code: 'content.movies.download', permission_name: 'تحميل الأفلام محلياً', effect: 'ALLOW' },
      { permission_code: 'content.series.download', permission_name: 'تحميل المسلسلات محلياً', effect: 'ALLOW' },
      { permission_code: 'features.download', permission_name: 'التحميل فائق السرعة', effect: 'ALLOW' },
      { permission_code: 'features.casting', permission_name: 'البث للشاشات (Casting)', effect: 'ALLOW' },
    ],
    members_count: 42,
  },
  {
    id: 'grp-kids',
    code: 'KIDS_SAFE_ZONE',
    name: 'منطقة الأطفال المحمية (Kids Safe Zone)',
    description: 'بيئة عائلية آمنة تمنح محتوى الأطفال فقط وتحظر صراحة أي محتوى VIP أو أفلام عامة غير مفلترة',
    is_system: true,
    priority: 300,
    permissions: [
      { permission_code: 'content.kids.view', permission_name: 'عرض محتوى الأطفال', effect: 'ALLOW' },
      { permission_code: 'content.kids.play', permission_name: 'تشغيل محتوى الأطفال', effect: 'ALLOW' },
      { permission_code: 'content.premium.view', permission_name: 'عرض المحتوى الحصري VIP', effect: 'DENY' },
      { permission_code: 'content.premium.play', permission_name: 'تشغيل المحتوى الحصري 4K VIP', effect: 'DENY' },
    ],
    members_count: 18,
  },
  {
    id: 'grp-night',
    code: 'NIGHT_STREAMERS',
    name: 'جلسات السهر الممتدة (Night Streamers)',
    description: 'مجموعة تمنح البث للشاشات والمشغل الخارجي VLC للغرف الخاصة ليلاً',
    is_system: false,
    priority: 150,
    permissions: [
      { permission_code: 'features.external_player', permission_name: 'التشغيل بمشغل خارجي', effect: 'ALLOW' },
      { permission_code: 'features.casting', permission_name: 'البث للشاشات (Casting)', effect: 'ALLOW' },
    ],
    members_count: 27,
  },
];

export const PHASE3_ROLE_ASSIGNMENTS: UserRoleAssignment[] = [
  {
    id: 'ura-1',
    user_id: 'usr-admin-01',
    user_name: 'م. أحمد الشمري (المدير التقني)',
    role_id: 'role-super-admin',
    role_code: 'SUPER_ADMIN',
    role_name: 'مدير عام المنظومة (Super Administrator)',
    role_scope: 'GLOBAL',
    tenant_id: null,
    tenant_name: null,
    site_id: null,
    site_name: null,
    assigned_at: '2026-03-01 09:00',
    is_active: true,
  },
  {
    id: 'ura-2',
    user_id: 'usr-branch-mgr',
    user_name: 'خالد التميمي (مدير فرع العليا)',
    role_id: 'role-site-manager',
    role_code: 'SITE_MANAGER',
    role_name: 'مدير الفرع / الموقع (Site Manager)',
    role_scope: 'SITE',
    tenant_id: 'tenant-lounge-co',
    tenant_name: 'شركة الاستراحات الموحدة',
    site_id: 'site-olaya-01',
    site_name: 'فرع العليا - صالة النخبة',
    assigned_at: '2026-03-02 11:30',
    is_active: true,
  },
  {
    id: 'ura-3',
    user_id: 'usr-content-curator',
    user_name: 'سارة الدوسري (أخصائية المحتوى)',
    role_id: 'role-content-mgr',
    role_code: 'CONTENT_MANAGER',
    role_name: 'مدير المحتوى والخوادم (Content Manager)',
    role_scope: 'TENANT',
    tenant_id: 'tenant-lounge-co',
    tenant_name: 'شركة الاستراحات الموحدة',
    site_id: null,
    site_name: null,
    assigned_at: '2026-03-05 14:15',
    is_active: true,
  },
];

export const PHASE3_RESOURCE_OVERRIDES: ResourcePermissionOverride[] = [
  {
    id: 'rpo-1',
    user_id: 'usr-basic-01',
    user_name: 'فهد العتيبي (بطاقة عادية)',
    resource_type: 'MEDIA_ITEM',
    resource_id: 'item-dune-2',
    resource_name: 'فيلم Dune: Part Two (4K VIP)',
    permission_code: 'content.premium.play',
    permission_name: 'تشغيل المحتوى الحصري 4K VIP',
    is_granted: true,
    reason: 'هدية ترويجية مؤقتة: فتح فيلم حصري لمدة 24 ساعة بمناسبة الافتتاح',
    expires_at: '2026-09-12 23:59',
  },
  {
    id: 'rpo-2',
    user_id: 'usr-kids-01',
    user_name: 'ريان وليد (حساب أطفال)',
    resource_type: 'MEDIA_ITEM',
    resource_id: 'item-oppenheimer',
    resource_name: 'فيلم Oppenheimer (دراما سينمائية)',
    permission_code: 'content.movies.view',
    permission_name: 'عرض مكتبة الأفلام',
    is_granted: false,
    reason: 'حظر أبوي صريح بناءً على طلب ولي الأمر',
    expires_at: null,
  },
];

/**
 * Client-Side Decision 59 Resolution Simulator
 */
export function simulateDecision59(
  user: LoungeUser,
  permissionCode: string,
  resourceType?: string,
  resourceId?: string,
  userRoleAssignments: UserRoleAssignment[] = PHASE3_ROLE_ASSIGNMENTS,
  groups: PermissionGroup[] = PHASE3_GROUPS,
  resourceOverrides: ResourcePermissionOverride[] = PHASE3_RESOURCE_OVERRIDES
): PermissionSimulationResult {
  const steps: PermissionSimulationResult['steps'] = [];
  let finalDecision = false;
  let decisionLayer = 'Deny by Default';
  let reason = 'المبدأ العام: كل وصول محظور افتراضياً (Deny by Default) حتى يمنحه مستوى صراحة';

  // 1. Global Superuser
  if (user.is_superuser) {
    steps.push({
      layer: '1. Global (Super Admin)',
      result: 'ALLOW',
      detail: 'المستخدم يملك رتبة Superuser العالمية المطلقة',
      active: true,
    });
    return {
      decision: true,
      decision_layer: 'Global (Super Admin)',
      reason: 'وصول كامل وغير مشروط بحكم امتلاك صلاحيات مدير عام المنظومة',
      permission_code: permissionCode,
      user_lounge_id: user.lounge_id,
      steps,
    };
  }

  // Check Role assignments
  const userRoles = userRoleAssignments.filter(ra => ra.user_id === user.id && ra.is_active);

  // 2. Global Roles
  const globalRole = userRoles.find(r => r.role_scope === 'GLOBAL');
  if (globalRole) {
    steps.push({
      layer: `1. Global Role: ${globalRole.role_name}`,
      result: 'ALLOW',
      detail: `الدور العالمي ${globalRole.role_code} يمنح كافة الصلاحيات بدون تقييد`,
      active: true,
    });
    finalDecision = true;
    decisionLayer = `Global Role (${globalRole.role_code})`;
    reason = `ممنوح بواسطة الدور العالمي ${globalRole.role_name}`;
  }

  // 3. Tenant Roles
  const tenantRole = userRoles.find(r => r.role_scope === 'TENANT');
  if (tenantRole) {
    const isApplicable = permissionCode.startsWith('content.') || permissionCode.startsWith('admin.servers.') || permissionCode.startsWith('admin.users.');
    steps.push({
      layer: `2. Tenant Role: ${tenantRole.role_name}`,
      result: isApplicable ? 'ALLOW' : 'SKIPPED',
      detail: `نطاق المستأجر [${tenantRole.tenant_name || 'عام'}] - صلاحية ${permissionCode}`,
      active: isApplicable,
    });
    if (isApplicable) {
      finalDecision = true;
      decisionLayer = `Tenant Role (${tenantRole.role_code})`;
      reason = `ممنوح ضمن نطاق المستأجر بواسطة ${tenantRole.role_name}`;
    }
  }

  // 4. Site Roles
  const siteRole = userRoles.find(r => r.role_scope === 'SITE');
  if (siteRole) {
    const isSitePerm = permissionCode.startsWith('admin.mikrotik.') || permissionCode.startsWith('admin.users.view') || permissionCode.startsWith('content.');
    steps.push({
      layer: `3. Site Role: ${siteRole.role_name}`,
      result: isSitePerm ? 'ALLOW' : 'SKIPPED',
      detail: `نطاق الفرع [${siteRole.site_name || 'الفرع المحلي'}]`,
      active: isSitePerm,
    });
    if (isSitePerm && !finalDecision) {
      finalDecision = true;
      decisionLayer = `Site Role (${siteRole.role_code})`;
      reason = `ممنوح ضمن صلاحيات إدارة الفرع المحلي (${siteRole.role_name})`;
    }
  }

  // 5. Group Membership (Ordered by priority)
  // Let's check if user has group matches
  const sortedGroups = [...groups].sort((a, b) => b.priority - a.priority);
  for (const grp of sortedGroups) {
    // Check if group has a matching rule
    const rule = grp.permissions.find(p => p.permission_code === permissionCode);
    if (rule) {
      const isUserInGroup = (grp.code === 'VIP_SUBSCRIBERS' && user.active_profile?.code === 'Premium') ||
                            (grp.code === 'KIDS_SAFE_ZONE' && user.active_profile?.code === 'Kids');

      steps.push({
        layer: `4. Group: ${grp.name} (Priority ${grp.priority})`,
        result: rule.effect,
        detail: `المجموعة ${grp.code} تحدد الأثر [${rule.effect}] للصلاحية ${permissionCode}`,
        active: isUserInGroup,
      });

      if (isUserInGroup) {
        if (rule.effect === 'ALLOW') {
          finalDecision = true;
          decisionLayer = `Group (${grp.name})`;
          reason = `ممنوح بواسطة مجموعة الصلاحيات ${grp.name} (أولوية: ${grp.priority})`;
        } else if (rule.effect === 'DENY') {
          finalDecision = false;
          decisionLayer = `Group (${grp.name}) - حظر صريح`;
          reason = `حظر صريح نافذ ومحدد من مجموعة ${grp.name}`;
        }
      }
    }
  }

  // 6. Individual User Overrides (Decision 12)
  const directOverride = user.overrides?.find(o => o.permission_code === permissionCode);
  if (directOverride) {
    const effect = directOverride.is_granted ? 'ALLOW' : 'DENY';
    steps.push({
      layer: '5. User Individual Override (القرار 12)',
      result: effect,
      detail: `استثناء فردي مسجل للمستخدم: ${directOverride.reason}`,
      active: true,
    });
    finalDecision = directOverride.is_granted;
    decisionLayer = `Individual Override (${effect})`;
    reason = `استثناء فردي مباشر للمستخدم (${effect}): ${directOverride.reason}`;
  }

  // 7. Profile Baseline
  const inProfile = user.active_profile?.permissions?.includes(permissionCode);
  steps.push({
    layer: `6. Profile Baseline (${user.active_profile?.name || 'بدون'})`,
    result: inProfile ? 'ALLOW' : 'DENY (ABSENT)',
    detail: `البروفايل الأساسي يحتوي على ${user.active_profile?.permissions?.length || 0} صلاحيات`,
    active: !!inProfile,
  });

  if (inProfile && decisionLayer === 'Deny by Default') {
    finalDecision = true;
    decisionLayer = `Profile (${user.active_profile.name})`;
    reason = `ممنوح افتراضياً وفق بروفايل المستخدم النشط (${user.active_profile.name})`;
  }

  // 8. Resource-Level Override (Decision 37)
  if (resourceType && resourceId) {
    const resOverride = resourceOverrides.find(
      r => r.user_id === user.id && r.resource_id === resourceId && r.permission_code === permissionCode
    );
    if (resOverride) {
      const effect = resOverride.is_granted ? 'ALLOW' : 'DENY';
      steps.push({
        layer: `7. Resource-Level Override (${resourceType} #${resourceId})`,
        result: effect,
        detail: `استثناء مخصص ومباشر لهذا العنصر بعينه: ${resOverride.reason}`,
        active: true,
      });
      finalDecision = resOverride.is_granted;
      decisionLayer = `Resource Override (${effect})`;
      reason = `قرار مخصص ومحدد على مستوى المورد [${resOverride.resource_name || resourceId}]: ${resOverride.reason}`;
    }
  }

  return {
    decision: finalDecision,
    decision_layer: decisionLayer,
    reason,
    permission_code: permissionCode,
    user_lounge_id: user.lounge_id,
    steps,
  };
}

/**
 * Client-Side Smart Content Access Engine (Decision 38)
 */
export function evaluateSmartContentAccess(
  user: LoungeUser,
  item: MediaItem,
  userRoleAssignments: UserRoleAssignment[] = PHASE3_ROLE_ASSIGNMENTS,
  groups: PermissionGroup[] = PHASE3_GROUPS,
  resourceOverrides: ResourcePermissionOverride[] = PHASE3_RESOURCE_OVERRIDES
): MediaAccessEvaluationResult {
  const isMovie = item.item_type === 'movie';
  const baseViewCode = isMovie ? 'content.movies.view' : 'content.series.view';
  const basePlayCode = isMovie ? 'content.movies.play' : 'content.series.play';
  const baseDlCode = isMovie ? 'content.movies.download' : 'content.series.download';

  const reasons: string[] = [];

  // Check View
  const viewSim = simulateDecision59(user, baseViewCode, 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
  let canView = viewSim.decision;

  // Premium View
  if (item.is_premium) {
    const premViewSim = simulateDecision59(user, 'content.premium.view', 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
    if (!premViewSim.decision && !user.is_superuser) {
      canView = false;
      reasons.push('هذا العمل مصنف VIP حصري ويتطلب اشتراك VIP أو بروفايل Premium');
    }
  }

  // Kids Filter
  if (user.active_profile?.code === 'Kids' && !item.is_kids) {
    canView = false;
    reasons.push('تم حجب هذا العمل تلقائياً لأن بروفايل المستخدم النشط مخصص للأطفال والعائلة فقط');
  }

  // Check Play
  let canStream = canView;
  if (canView) {
    const playSim = simulateDecision59(user, basePlayCode, 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
    canStream = playSim.decision;

    if (item.is_premium) {
      const premPlaySim = simulateDecision59(user, 'content.premium.play', 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
      if (!premPlaySim.decision && !user.is_superuser) {
        canStream = false;
        reasons.push('غير مصرح لك ببث المحتوى فائق الوضوح VIP 4K');
      }
    }

    if (item.resolution?.includes('4K') && !user.is_superuser) {
      const hasPrem = user.active_profile?.code === 'Premium' || user.active_profile?.permissions?.includes('content.premium.play');
      if (!hasPrem) {
        canStream = false;
        reasons.push('تشغيل دقة 4K HDR يتطلب حزمة الباندويث المخصصة لكروت الـ VIP');
      }
    }
  }

  // Check Download
  let canDownload = false;
  if (canStream) {
    const dlSim = simulateDecision59(user, baseDlCode, 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
    const genDlSim = simulateDecision59(user, 'content.download', 'MEDIA_ITEM', item.id, userRoleAssignments, groups, resourceOverrides);
    canDownload = dlSim.decision || genDlSim.decision;

    if (!canDownload) {
      reasons.push('التحميل المباشر للشبكة المحلية غير متاح في باقتك الحالية (بث مباشر داخل الاستراحة فقط)');
    }
  }

  return {
    item_id: item.id,
    title: item.title,
    can_view: canView,
    can_stream: canStream,
    can_download: canDownload,
    is_premium: item.is_premium,
    is_kids: item.is_kids,
    resolution: item.resolution,
    reasons,
    quality_profile: (item.resolution?.includes('4K') && canStream) ? '4K HDR Cinema Bitrate' : '1080p FHD Standard',
    external_player_allowed: simulateDecision59(user, 'features.external_player').decision,
    casting_allowed: simulateDecision59(user, 'features.casting').decision,
  };
}
