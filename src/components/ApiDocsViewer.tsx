import React, { useState } from 'react';
import { 
  Terminal, 
  Send, 
  Check, 
  Copy, 
  Code, 
  Layers, 
  Key, 
  Shield, 
  Database,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { LoungeUser } from '../types';
import { PermissionEngineClient } from '../services/permissionEngine';

interface ApiDocsViewerProps {
  currentUser: LoungeUser;
}

interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  requestBody?: any;
  responseMock: (user: LoungeUser) => any;
}

export const ApiDocsViewer: React.FC<ApiDocsViewerProps> = ({ currentUser }) => {
  const endpoints: Endpoint[] = [
    {
      id: 'me',
      method: 'GET',
      path: '/api/v1/users/me/',
      title: 'استعلام عن المستخدم الحالي والصلاحيات الفعلية',
      description: 'يقوم بإرجاع بيانات المستخدم النشط، البروفايل المعين، وقائمة الصلاحيات الفعلية الناتجة عن محرك الصلاحيات (PermissionEngine).',
      responseMock: (user) => ({
        id: user.id,
        lounge_id: user.lounge_id,
        username: user.username,
        full_name: user.full_name,
        language: user.language,
        timezone: user.timezone,
        status: user.status,
        active_profile: {
          name: user.active_profile.name,
          code: user.active_profile.code,
          max_devices: user.active_profile.max_devices,
          max_concurrent_sessions: user.active_profile.max_concurrent_sessions,
        },
        effective_permissions: Array.from(PermissionEngineClient.getEffectivePermissions(user)),
        entitlements: {
          can_stream_movies: PermissionEngineClient.hasPermission(user, 'content.movies.view'),
          can_stream_series: PermissionEngineClient.hasPermission(user, 'content.series.view'),
          can_stream_kids: PermissionEngineClient.hasPermission(user, 'content.kids.view'),
          can_stream_premium: PermissionEngineClient.hasPermission(user, 'content.premium.view'),
          can_download: PermissionEngineClient.canDownload(user),
          is_admin: user.is_staff || user.is_superuser,
        },
      }),
    },
    {
      id: 'token',
      method: 'POST',
      path: '/api/v1/auth/token/',
      title: 'المصادقة وتوليد JWT Token (SimpleJWT)',
      description: 'تسجيل الدخول وتوليد Access Token و Refresh Token للتعامل مع الـ API بأمان.',
      requestBody: {
        username: currentUser.username,
        password: '••••••••••••',
      },
      responseMock: (user) => ({
        access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoi' + user.id.slice(0, 8) + '...smart_lounge_token',
        refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_token_' + user.lounge_id,
        token_type: 'Bearer',
        expires_in_hours: 8,
      }),
    },
    {
      id: 'items',
      method: 'GET',
      path: '/api/v1/content/items/',
      title: 'كتالوج الوسائط المفلتر بالصلاحيات',
      description: 'إرجاع الوسائط المسموح للمستخدم الحالي بمشاهدتها فقط، مع حجب المحتوى غير المصرح به أو الوسائط الحصرية إذا لم تتوفر الصلاحية.',
      responseMock: (user) => {
        const canMovies = PermissionEngineClient.hasPermission(user, 'content.movies.view');
        const canKids = PermissionEngineClient.hasPermission(user, 'content.kids.view');
        const canPremium = PermissionEngineClient.hasPermission(user, 'content.premium.view');
        return {
          count: canPremium ? 9 : canMovies ? 7 : 3,
          results: [
            {
              id: 'med-3',
              title: 'بين النجوم (Interstellar)',
              item_type: 'movie',
              resolution: '1080p FHD',
              is_premium: false,
              is_kids: false,
              can_play: canMovies,
              can_download: PermissionEngineClient.canDownload(user),
            },
            {
              id: 'med-1',
              title: 'أوبنهايمر (Oppenheimer)',
              item_type: 'movie',
              resolution: '4K HDR Dolby Vision',
              is_premium: true,
              can_play: canPremium,
              can_download: PermissionEngineClient.canDownload(user),
            },
          ],
        };
      },
    },
    {
      id: 'sync',
      method: 'POST',
      path: '/api/v1/media-servers/srv-1/sync-libraries/',
      title: 'مزامنة واكتشاف مكتبات Jellyfin / Emby',
      description: 'يقوم الباك إند بالاتصال بسيرفر الوسائط عبر الـ API لاكتشاف المجلدات والأفلام والمواسم والحلقات وتخزينها في قاعدة البيانات.',
      responseMock: () => ({
        message: 'تمت مزامنة 3 مكتبات من Lounge Media Server 01',
        libraries: ['أفلام VIP 4K سينمائية', 'مكتبة الأفلام العامة', 'واحة كرتون الأطفال'],
        total_discovered_items: 24,
        synced_at: new Date().toISOString(),
      }),
    },
    {
      id: 'captive_login',
      method: 'POST',
      path: '/api/v1/auth/captive-portal/login/',
      title: 'تسجيل ومصادقة كارت الهوتسبوت (Captive Portal & SSO)',
      description: 'يستقبل بيانات كارت الدخول (Voucher) وجهاز العميل، يفحص الصلاحية عبر RADIUS، ينشئ أو يطابق Lounge User ID، ويصدر جلسة مشفرة و OTT.',
      requestBody: {
        external_id: 'VIP-77002',
        identity_type: 'RADIUS',
        ip_address: '192.168.1.104',
        mac_address: 'E4:5F:01:88:B2:10',
        user_agent: 'Mozilla/5.0 MacBook Pro M3',
      },
      responseMock: (user) => ({
        message: 'تم التحقق من هوية المستخدم بنجاح ومزامنته مع نظام الاستراحة الذكية',
        is_first_time: false,
        lounge_user_id: user.lounge_id,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          profile: user.active_profile.name,
        },
        tokens: {
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoi...',
          refresh: 'ref_984128fba019c4d8e871239...',
          session_id: 'sess-001',
          session_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        },
        one_time_token: 'ott_live_7721890_60s_ttl',
        radius_server_used: 'FreeRADIUS-Core-01 (Primary @ 192.168.1.10)',
        radius_attributes: {
          'Mikrotik-Group': 'VIP_Lounge_4K',
          'Session-Timeout': 86400,
        },
      }),
    },
    {
      id: 'sso_exchange',
      method: 'POST',
      path: '/api/v1/auth/sso/exchange/',
      title: 'استبدال رمز الـ One-Time Token (OTT Exchange)',
      description: 'يقوم بتبديل الرمز المؤقت (OTT) أحادي الاستخدام (60s TTL) بتوكنات الجلسة الكاملة للتحويل السلس من صفحة الهوتسبوت إلى بوابة الاستراحة.',
      requestBody: {
        one_time_token: 'ott_live_7721890_60s_ttl',
      },
      responseMock: (user) => ({
        message: 'تم إتمام المصادقة الأحادية (SSO) بنجاح',
        user: {
          lounge_id: user.lounge_id,
          full_name: user.full_name,
        },
        tokens: {
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoi...',
          refresh: 'ref_339109bcfa19...',
        },
      }),
    },
    {
      id: 'token_rotation',
      method: 'POST',
      path: '/api/v1/auth/token/refresh-rotated/',
      title: 'تدوير توكن الجلسة الإجباري (Refresh Token Rotation)',
      description: 'وفق القرار 10: عند تجديد الجلسة، يتم إلغاء الـ Refresh Token السابق فوراً وتضمينه في القائمة السوداء لمنع هجمات إعادة التشغيل (Replay Attacks).',
      requestBody: {
        refresh_token: 'ref_old_token_to_rotate',
      },
      responseMock: () => ({
        message: 'تم تدوير توكن الجلسة وتجديده بنجاح',
        tokens: {
          access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access...',
          refresh: 'ref_new_rotated_token_88921...',
        },
      }),
    },
    {
      id: 'mikrotik_active_users',
      method: 'GET',
      path: '/api/v1/gateways/mikrotik/routers/mt-router-01/active-users/',
      title: 'قائمة مستخدمي الهوتسبوت النشطين على راوتر MikroTik',
      description: 'يستعلم عن الأجهزة المتصلة بالهوتسبوت وعناوين الـ IP والـ MAC واستهلاك البيانات عبر RouterOS API بصلاحيات مقيدة (Decision 31).',
      responseMock: () => ({
        router_name: 'MikroTik-Lounge-Core',
        count: 3,
        active_users: [
          { user: 'VIP-77002', address: '192.168.1.104', mac: 'E4:5F:01:88:B2:10', uptime: '03:22:15' },
          { user: 'CARD-10001', address: '192.168.1.115', mac: '40:B0:34:F1:C9:22', uptime: '04:05:30' },
          { user: 'KIDS-33010', address: '192.168.1.160', mac: '00:1A:79:4C:E5:88', uptime: '02:45:10' },
        ],
      }),
    },
    {
      id: 'radius_failover_test',
      method: 'POST',
      path: '/api/v1/gateways/radius/servers/test-auth/',
      title: 'فحص مصادقة RADIUS مع سلسلة التجاوز (Decision 32)',
      description: 'يفحص كارت الهوتسبوت عبر Primary ثم Standby ثم Failover ويعيد زمن الاستجابة والمجموعة المعتمدة.',
      requestBody: {
        card_number: 'VIP-77002',
      },
      responseMock: () => ({
        is_valid: true,
        server_used: 'FreeRADIUS-Core-01 (Primary @ 192.168.1.10)',
        latency_ms: 1.1,
        attributes: {
          'User-Name': 'VIP-77002',
          'Mikrotik-Group': 'VIP_Lounge_4K',
          'Session-Timeout': 86400,
        },
        message: 'تم فحص استجابة خادم RADIUS بنجاح',
      }),
    },
    {
      id: 'audit_logs_list',
      method: 'GET',
      path: '/api/v1/core/audit-logs/',
      title: 'استعراض سجلات التدقيق الأمني (Decision 35)',
      description: 'يقوم بإرجاع سجلات الأحداث الأمنية الشاملة مع استبعاد أي كلمات مرور أو توكنات صريحة لحماية الخصوصية.',
      responseMock: (user) => ({
        count: 4,
        results: [
          { event: 'SSO_REGISTER', user_lounge_id: 'LU-000103', identity: 'RADIUS:KIDS-33010', ip: '192.168.1.160' },
          { event: 'LOGIN_SUCCESS', user_lounge_id: user.lounge_id, identity: 'RADIUS:VIP-77002', ip: '192.168.1.104' },
          { event: 'TOKEN_ROTATED', user_lounge_id: 'LU-000102', identity: 'RADIUS:CARD-10001', ip: '192.168.1.115' },
        ],
      }),
    },
    {
      id: 'permission_simulate',
      method: 'POST',
      path: '/api/v1/permissions/simulate-evaluation/',
      title: 'محاكاة تقييم الصلاحيات الهجين (Decision 59 Trace)',
      description: 'يقوم بتتبع سلسلة اتخاذ القرار خطوة بخطوة من Global ← Tenant ← Site ← Group ← User ← Profile ← Resource وإرجاع مسار القرار والمستوى الحاسم.',
      requestBody: {
        user_id: 'usr-1',
        permission_code: 'content.premium.play',
        resource_type: 'MEDIA_ITEM',
        resource_id: 'item-dune-2',
      },
      responseMock: (user) => ({
        decision: user.active_profile.code === 'Premium' || user.is_superuser,
        decision_layer: user.is_superuser ? 'Global (Super Admin)' : (user.active_profile.code === 'Premium' ? 'Group (VIP_SUBSCRIBERS)' : 'Deny by Default'),
        reason: user.active_profile.code === 'Premium' ? 'ممنوح بواسطة مجموعة المشتركين VIP (Priority 200)' : 'المبدأ العام: Deny by Default - لم يتم العثور على قاعدة تمنح الإذن',
        permission_code: 'content.premium.play',
        user_lounge_id: user.lounge_id,
        steps: [
          { layer: '1. Global (Super Admin)', result: user.is_superuser ? 'ALLOW' : 'SKIPPED', active: user.is_superuser },
          { layer: '2. Tenant Scoped Roles', result: 'SKIPPED', active: false },
          { layer: '3. Site Scoped Roles', result: 'SKIPPED', active: false },
          { layer: '4. Group (VIP_SUBSCRIBERS)', result: user.active_profile.code === 'Premium' ? 'ALLOW' : 'DENY (ABSENT)', active: user.active_profile.code === 'Premium' },
          { layer: '5. User Individual Overrides', result: 'DENY (ABSENT)', active: false },
          { layer: '6. Profile Baseline', result: user.active_profile.code === 'Premium' ? 'ALLOW' : 'DENY (ABSENT)', active: user.active_profile.code === 'Premium' },
        ],
      }),
    },
    {
      id: 'media_access_evaluate',
      method: 'POST',
      path: '/api/v1/permissions/evaluate-media-access/',
      title: 'فحص مصفوفة الوصول الذكي للمحتوى (Decision 38)',
      description: 'يفحص إمكانية العرض والبث المباشر والتحميل المحلي لمادة إعلامية معينة بناء على تصنيفها ودقتها وعزل حسابات الأطفال.',
      requestBody: {
        media_item_id: 'item-dune-2',
      },
      responseMock: (user) => ({
        item_id: 'item-dune-2',
        title: 'فيلم Dune: Part Two (4K VIP)',
        can_view: user.active_profile.code !== 'Kids',
        can_stream: user.active_profile.code === 'Premium' || user.is_superuser,
        can_download: user.active_profile.code === 'Premium' || user.is_superuser,
        is_premium: true,
        is_kids: false,
        resolution: '4K Ultra-HD HDR',
        quality_profile: (user.active_profile.code === 'Premium' || user.is_superuser) ? '4K HDR Cinema Bitrate' : '1080p FHD Standard',
        external_player_allowed: true,
        casting_allowed: true,
        reasons: user.active_profile.code === 'Kids'
          ? ['تم حجب هذا العمل تلقائياً لأن البروفايل محدد للأطفال والعائلة فقط']
          : (user.active_profile.code === 'Basic' ? ['المحتوى مصنف VIP حصري ويتطلب ترقية الباقة أو إسناد دور VIP'] : []),
      }),
    },
    {
      id: 'roles_list',
      method: 'GET',
      path: '/api/v1/roles/',
      title: 'استعراض الأدوار المركزية (Decision 37)',
      description: 'قائمة بكافة الأدوار النظامية ومستويات النطاق (GLOBAL, TENANT, SITE, USER) وعدد الصلاحيات المخصصة.',
      responseMock: () => ({
        count: 6,
        results: [
          { code: 'SUPER_ADMIN', name: 'مدير عام المنظومة', scope_level: 'GLOBAL', permissions_count: 34, is_system: true },
          { code: 'TENANT_ADMIN', name: 'مدير المستأجر', scope_level: 'TENANT', permissions_count: 24, is_system: true },
          { code: 'SITE_MANAGER', name: 'مدير الفرع / الموقع', scope_level: 'SITE', permissions_count: 16, is_system: true },
          { code: 'CONTENT_MANAGER', name: 'مدير المحتوى والخوادم', scope_level: 'TENANT', permissions_count: 18, is_system: true },
          { code: 'SUPPORT', name: 'مسؤول الدعم الفني', scope_level: 'SITE', permissions_count: 10, is_system: true },
          { code: 'USER', name: 'مستخدم الاستراحة الافتراضي', scope_level: 'USER', permissions_count: 7, is_system: true },
        ],
      }),
    },
    {
      id: 'permission_cache_invalidate',
      method: 'POST',
      path: '/api/v1/permissions/cache-invalidate/',
      title: 'إبطال كاش الصلاحيات في Redis (Cache Invalidation)',
      description: 'مسح فوري للكاش المؤقت لمستخدم بعينه أو لمستأجر كامل وإعادة فرض تقييم شجرة الصلاحيات عند الطلب التالي.',
      requestBody: {
        user_id: 'usr-1',
      },
      responseMock: () => ({
        status: 'success',
        message: 'تم إبطال الكاش للصلاحيات بنجاح (usr-1)',
        cleared_at: new Date().toISOString(),
      }),
    },
  ];

  const [selectedEndpointId, setSelectedEndpointId] = useState('me');
  const [responseOutput, setResponseOutput] = useState<any>(null);
  const [latency, setLatency] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedEndpoint = endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0];

  const handleExecuteRequest = () => {
    setIsLoading(true);
    setResponseOutput(null);

    const start = performance.now();
    setTimeout(() => {
      const end = performance.now();
      setLatency(Math.round(end - start));
      setResponseOutput(selectedEndpoint.responseMock(currentUser));
      setIsLoading(false);
    }, 280);
  };

  const handleCopyJson = () => {
    if (!responseOutput) return;
    navigator.clipboard.writeText(JSON.stringify(responseOutput, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Django REST Framework + SimpleJWT + OpenAPI</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            بوابة واجهة برمجة التطبيقات (API Gateway & Interactive Console)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            تم بناء طبقة الـ API وفق معايير DRF مع توثيق drf-spectacular ومصادقة JWT. اختبر استجابة الـ Endpoints مباشرة بالاعتماد على هوية وصلاحيات المستخدم الحالي.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">توثيق OpenAPI التفاعلي:</span>
          <span className="font-mono text-amber-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
            /api/docs/ (Swagger UI)
          </span>
        </div>
      </div>

      {/* Grid: Endpoints list + Runner Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
            نقاط النهاية المتاحة (V1 Endpoints)
          </div>
          <div className="space-y-1.5">
            {endpoints.map((ep) => {
              const isSelected = ep.id === selectedEndpoint.id;
              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEndpointId(ep.id);
                    setResponseOutput(null);
                  }}
                  className={`w-full text-right p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-850 border-amber-500/40 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-850/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[170px]">
                      {ep.title}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {ep.path}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Runner Console */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Request Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  selectedEndpoint.method === 'GET'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {selectedEndpoint.method}
                </span>
                <span className="text-xs font-mono text-slate-200 font-semibold">
                  {selectedEndpoint.path}
                </span>
              </div>

              <button
                onClick={handleExecuteRequest}
                disabled={isLoading}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all whitespace-nowrap self-end sm:self-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isLoading ? 'جاري الإرسال...' : 'إرسال طلب تجريبي'}</span>
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-400 leading-relaxed">
              {selectedEndpoint.description}
            </p>

            {/* Request Body if applicable */}
            {selectedEndpoint.requestBody && (
              <div>
                <div className="text-[11px] font-bold text-slate-400 mb-1.5">Request Payload (JSON):</div>
                <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-amber-300/90 overflow-x-auto">
                  {JSON.stringify(selectedEndpoint.requestBody, null, 2)}
                </pre>
              </div>
            )}

            {/* Response Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-300">Response (HTTP Status & Headers):</span>
                  {responseOutput && (
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      200 OK • {latency}ms
                    </span>
                  )}
                </div>

                {responseOutput && (
                  <button
                    onClick={handleCopyJson}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ!' : 'نسخ JSON'}</span>
                  </button>
                )}
              </div>

              <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300/90 overflow-x-auto min-h-[220px] max-h-[380px] leading-relaxed">
                {responseOutput
                  ? JSON.stringify(responseOutput, null, 2)
                  : `// انقر على "إرسال طلب تجريبي" لتنفيذ الاستعلام كـ: ${currentUser.full_name}\n// وتجربة كيفية استجابة الباك إند بناءً على صلاحيات الـ Lounge ID: ${currentUser.lounge_id}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
