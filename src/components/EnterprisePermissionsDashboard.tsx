import React, { useState, useMemo } from 'react';
import {
  Shield, Check, X, Crown, Sliders, Lock,
  AlertTriangle, RotateCcw, Zap, Info, Search,
  Eye, Play, Download, Layers,
  Terminal, Building2, MapPin, Sparkles,
  ChevronRight, RefreshCw, KeyRound, Database,
  ArrowRight
} from 'lucide-react';
import {
  LoungeUser, Permission, Profile, UserPermissionOverride,
  Role, PermissionGroup, UserRoleAssignment, ResourcePermissionOverride,
  MediaItem, PermissionCategory
} from '../types';
import {
  PHASE3_PERMISSIONS, PHASE3_ROLES, PHASE3_GROUPS,
  PHASE3_ROLE_ASSIGNMENTS, PHASE3_RESOURCE_OVERRIDES,
  simulateDecision59, evaluateSmartContentAccess
} from '../data/phase3Data';

interface EnterprisePermissionsDashboardProps {
  users: LoungeUser[];
  profiles: Profile[];
  permissions: Permission[];
  mediaItems: MediaItem[];
  selectedUser: LoungeUser;
  onSelectUser: (user: LoungeUser) => void;
  onUpdateUser: (user: LoungeUser) => void;
}

export const EnterprisePermissionsDashboard: React.FC<EnterprisePermissionsDashboardProps> = ({
  users,
  profiles,
  permissions: propPermissions,
  mediaItems,
  selectedUser,
  onSelectUser,
  onUpdateUser,
}) => {
  // Navigation tabs within Authorization Center
  const [activeTab, setActiveTab] = useState<
    'decision-simulator' | 'roles-scoped' | 'permission-groups' | 'permissions-catalog' | 'redis-audit'
  >('decision-simulator');

  // Combined permissions catalog
  const catalog = useMemo(() => {
    const map = new Map<string, Permission>();
    PHASE3_PERMISSIONS.forEach(p => map.set(p.code, p));
    propPermissions.forEach(p => {
      if (!map.has(p.code)) {
        map.set(p.code, {
          ...p,
          category: p.category as PermissionCategory,
          resource_type: 'SYSTEM',
          action: 'manage',
          requires_scope: false,
        });
      }
    });
    return Array.from(map.values());
  }, [propPermissions]);

  // Roles & Groups State
  const [roles] = useState<Role[]>(PHASE3_ROLES);
  const [groups, setGroups] = useState<PermissionGroup[]>(PHASE3_GROUPS);
  const [roleAssignments, setRoleAssignments] = useState<UserRoleAssignment[]>(PHASE3_ROLE_ASSIGNMENTS);
  const [resourceOverrides, setResourceOverrides] = useState<ResourcePermissionOverride[]>(PHASE3_RESOURCE_OVERRIDES);

  // Decision 59 Simulator State
  const [simulatorMode, setSimulatorMode] = useState<'permission' | 'media'>('media');
  const [selectedPermCode, setSelectedPermCode] = useState<string>('content.premium.play');
  const [selectedMediaId, setSelectedMediaId] = useState<string>(mediaItems[0]?.id || 'item-dune-2');
  const [selectedSimUserId, setSelectedSimUserId] = useState<string>(selectedUser.id);

  // Redis Cache Simulation State
  const [cacheStatus, setCacheStatus] = useState<Record<string, { hits: number; ttl: number; state: 'CACHED' | 'INVALIDATED' }>>({
    [`lounge:perms:${selectedUser.id}:default:main`]: { hits: 142, ttl: 2840, state: 'CACHED' },
  });
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  // New Role Assignment Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newAssignUserId, setNewAssignUserId] = useState(selectedUser.id);
  const [newAssignRoleCode, setNewAssignRoleCode] = useState('SITE_MANAGER');
  const [newAssignTenant, setNewAssignTenant] = useState('شركة الاستراحات الموحدة');
  const [newAssignSite, setNewAssignSite] = useState('فرع العليا - صالة النخبة');

  // New Resource Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideUserId, setOverrideUserId] = useState(selectedUser.id);
  const [overrideMediaId, setOverrideMediaId] = useState(mediaItems[0]?.id || '');
  const [overridePermCode, setOverridePermCode] = useState('content.premium.play');
  const [overrideGranted, setOverrideGranted] = useState(true);
  const [overrideReason, setOverrideReason] = useState('تصريح استثنائي مباشر من الإدارة');

  // Find simulated user
  const simUser = useMemo(() => {
    return users.find(u => u.id === selectedSimUserId) || selectedUser;
  }, [users, selectedSimUserId, selectedUser]);

  // Selected media item for content evaluation
  const targetMedia = useMemo(() => {
    return mediaItems.find(m => m.id === selectedMediaId) || mediaItems[0];
  }, [mediaItems, selectedMediaId]);

  // Run Decision 59 Trace
  const simulationTrace = useMemo(() => {
    if (simulatorMode === 'permission') {
      return simulateDecision59(simUser, selectedPermCode, undefined, undefined, roleAssignments, groups, resourceOverrides);
    } else if (targetMedia) {
      const code = targetMedia.is_premium ? 'content.premium.play' : (targetMedia.item_type === 'movie' ? 'content.movies.play' : 'content.series.play');
      return simulateDecision59(simUser, code, 'MEDIA_ITEM', targetMedia.id, roleAssignments, groups, resourceOverrides);
    }
    return null;
  }, [simulatorMode, simUser, selectedPermCode, targetMedia, roleAssignments, groups, resourceOverrides]);

  // Run Smart Content Access Engine (Decision 38)
  const contentAccessResult = useMemo(() => {
    if (!targetMedia) return null;
    return evaluateSmartContentAccess(simUser, targetMedia, roleAssignments, groups, resourceOverrides);
  }, [simUser, targetMedia, roleAssignments, groups, resourceOverrides]);

  // Invalidate Redis Cache
  const handleInvalidateCache = (userId?: string) => {
    const key = `lounge:perms:${userId || simUser.id}:default:main`;
    setCacheStatus(prev => ({
      ...prev,
      [key]: { hits: 0, ttl: 3600, state: 'INVALIDATED' }
    }));
    setCacheNotice(`تم مسح الذاكرة المؤقتة (Redis Cache Invalidation) للمستخدم بنجاح.`);
    setTimeout(() => setCacheNotice(null), 4000);
  };

  // Add Role Assignment
  const handleCreateRoleAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const roleObj = roles.find(r => r.code === newAssignRoleCode);
    const userObj = users.find(u => u.id === newAssignUserId);
    if (!roleObj || !userObj) return;

    const newAssignment: UserRoleAssignment = {
      id: `ura-${Date.now()}`,
      user_id: userObj.id,
      user_name: userObj.full_name || userObj.username,
      role_id: roleObj.id,
      role_code: roleObj.code,
      role_name: roleObj.name,
      role_scope: roleObj.scope_level,
      tenant_id: roleObj.scope_level === 'TENANT' || roleObj.scope_level === 'SITE' ? 'tenant-1' : null,
      tenant_name: roleObj.scope_level === 'TENANT' || roleObj.scope_level === 'SITE' ? newAssignTenant : null,
      site_id: roleObj.scope_level === 'SITE' ? 'site-1' : null,
      site_name: roleObj.scope_level === 'SITE' ? newAssignSite : null,
      assigned_at: new Date().toISOString().replace('T', ' ').slice(0, 16),
      is_active: true,
    };

    setRoleAssignments(prev => [newAssignment, ...prev]);
    setShowAssignModal(false);
    handleInvalidateCache(userObj.id);
  };

  // Add Resource Override
  const handleCreateResourceOverride = (e: React.FormEvent) => {
    e.preventDefault();
    const userObj = users.find(u => u.id === overrideUserId);
    const mediaObj = mediaItems.find(m => m.id === overrideMediaId);
    const permObj = catalog.find(p => p.code === overridePermCode);
    if (!userObj || !mediaObj || !permObj) return;

    const newOverride: ResourcePermissionOverride = {
      id: `rpo-${Date.now()}`,
      user_id: userObj.id,
      user_name: userObj.full_name || userObj.username,
      resource_type: 'MEDIA_ITEM',
      resource_id: mediaObj.id,
      resource_name: mediaObj.title,
      permission_code: permObj.code,
      permission_name: permObj.name,
      is_granted: overrideGranted,
      reason: overrideReason,
      expires_at: '2026-09-30 23:59',
    };

    setResourceOverrides(prev => [newOverride, ...prev]);
    setShowOverrideModal(false);
    handleInvalidateCache(userObj.id);
  };

  // Catalog Filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');

  const filteredCatalog = useMemo(() => {
    return catalog.filter(p => {
      const matchSearch = p.code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          p.name.includes(catalogSearch) ||
                          p.description.includes(catalogSearch);
      const matchCategory = catalogCategory === 'all' || p.category === catalogCategory;
      return matchSearch && matchCategory;
    });
  }, [catalog, catalogSearch, catalogCategory]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white flex-shrink-0">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-wide">
                  محرك الصلاحيات الهجين والتحكم الذكي بالمحتوى
                </h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Phase 3 Enterprise
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Decision 59 &amp; 38
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                مصفوفة تصريح متكاملة تطبق مبدأ <strong className="text-slate-200">المنع الافتراضي (Deny by Default)</strong> عبر تدرج:
                العالمي (Global) ← المستأجر (Tenant) ← الفرع (Site) ← المجموعات (Groups) ← استثناءات المستخدم (User Overrides) ← البروفايل (Profile) ← استثناءات الموارد (Resource Overrides).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800 self-start lg:self-center">
            <button
              onClick={() => handleInvalidateCache()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700"
              title="تفريغ ذاكرة Redis المؤقتة وإعادة بناء شجرة الصلاحيات"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              تفريغ كاش الصلاحيات
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div className="px-3 py-1.5 text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Redis Cache Active
            </div>
          </div>
        </div>

        {/* Invalidation Alert Notification */}
        {cacheNotice && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-200 animate-fadeIn">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{cacheNotice}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-6 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('decision-simulator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'decision-simulator'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            محاكي اتخاذ القرار (Decision 59 Trace)
          </button>

          <button
            onClick={() => setActiveTab('roles-scoped')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'roles-scoped'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            الأدوار المركزية وتعيينات النطاق
          </button>

          <button
            onClick={() => setActiveTab('permission-groups')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'permission-groups'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            المجموعات واستثناءات الموارد
          </button>

          <button
            onClick={() => setActiveTab('permissions-catalog')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'permissions-catalog'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            فهرس الصلاحيات ({catalog.length})
          </button>

          <button
            onClick={() => setActiveTab('redis-audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'redis-audit'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            كاش Redis وسجلات التدقيق
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DECISION 59 TRACE & SMART CONTENT ACCESS SIMULATOR */}
      {/* ========================================================= */}
      {activeTab === 'decision-simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Panel (Left Col) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                معايير الفحص والمحاكاة
              </h3>

              {/* Select User */}
              <div className="space-y-2 mb-4">
                <label className="text-xs font-medium text-slate-300">مستخدم الاستراحة المراد فحصه</label>
                <select
                  value={selectedSimUserId}
                  onChange={(e) => setSelectedSimUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} ({u.lounge_id}) - [{u.active_profile?.name}]
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                  <span>البروفايل: <strong className="text-amber-400">{simUser.active_profile?.name}</strong></span>
                  <span>الرتبة: <strong className="text-slate-300">{simUser.is_superuser ? 'Super Admin' : 'Standard User'}</strong></span>
                </div>
              </div>

              {/* Mode Switch: Content Media vs Raw Permission */}
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">نوع الفحص</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setSimulatorMode('media')}
                    className={`py-2 text-xs rounded-lg font-medium transition-all ${
                      simulatorMode === 'media'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    مادة إعلامية (Smart Access)
                  </button>
                  <button
                    onClick={() => setSimulatorMode('permission')}
                    className={`py-2 text-xs rounded-lg font-medium transition-all ${
                      simulatorMode === 'permission'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    صلاحية محددة (Raw Code)
                  </button>
                </div>
              </div>

              {simulatorMode === 'media' ? (
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-medium text-slate-300">اختر مادة من الفهرس المحلي</label>
                  <select
                    value={selectedMediaId}
                    onChange={(e) => setSelectedMediaId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {mediaItems.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title} {m.is_premium ? '★ [VIP 4K]' : ''} {m.is_kids ? '🧸 [Kids]' : ''} ({m.item_type})
                      </option>
                    ))}
                  </select>

                  {targetMedia && (
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-1.5 mt-2">
                      <div className="flex justify-between text-slate-300">
                        <span>النوع: <strong>{targetMedia.item_type === 'movie' ? 'فيلم سينمائي' : 'مسلسل'}</strong></span>
                        <span>الدقة: <strong>{targetMedia.resolution || '1080p FHD'}</strong></span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>VIP حصرى: <strong className={targetMedia.is_premium ? 'text-amber-400' : 'text-slate-400'}>{targetMedia.is_premium ? 'نعم' : 'لا'}</strong></span>
                        <span>عائلي/أطفال: <strong className={targetMedia.is_kids ? 'text-emerald-400' : 'text-slate-400'}>{targetMedia.is_kids ? 'نعم' : 'لا'}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  <label className="text-xs font-medium text-slate-300">كود الصلاحية المفحوص</label>
                  <select
                    value={selectedPermCode}
                    onChange={(e) => setSelectedPermCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  >
                    {catalog.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Preset Scenarios */}
              <div className="border-t border-slate-800 pt-4 mt-4">
                <label className="text-xs font-medium text-slate-400 mb-2 block">سيناريوهات اختبار سريعة:</label>
                <div className="space-y-1.5">
                  <button
                    onClick={() => {
                      const vipUser = users.find(u => u.active_profile?.code === 'Premium') || users[0];
                      setSelectedSimUserId(vipUser.id);
                      setSimulatorMode('media');
                      const premItem = mediaItems.find(m => m.is_premium) || mediaItems[0];
                      setSelectedMediaId(premItem.id);
                    }}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>عميل Premium مع فيلم 4K VIP</span>
                    <ArrowRight className="w-3 h-3 rotate-180 text-amber-400" />
                  </button>

                  <button
                    onClick={() => {
                      const kidsUser = users.find(u => u.active_profile?.code === 'Kids') || users[0];
                      setSelectedSimUserId(kidsUser.id);
                      setSimulatorMode('media');
                      const premItem = mediaItems.find(m => m.is_premium) || mediaItems[0];
                      setSelectedMediaId(premItem.id);
                    }}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs bg-slate-950 hover:bg-slate-800 text-rose-300 border border-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>حساب أطفال يحاول فتح فيلم VIP (اختبار عزل)</span>
                    <ArrowRight className="w-3 h-3 rotate-180 text-rose-400" />
                  </button>

                  <button
                    onClick={() => {
                      const basicUser = users.find(u => u.active_profile?.code === 'Basic') || users[0];
                      setSelectedSimUserId(basicUser.id);
                      setSimulatorMode('media');
                      const normalMovie = mediaItems.find(m => !m.is_premium && !m.is_kids) || mediaItems[0];
                      setSelectedMediaId(normalMovie.id);
                    }}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 transition-all flex items-center justify-between"
                  >
                    <span>مستخدم عادي مع فيلم قياسي 1080p</span>
                    <ArrowRight className="w-3 h-3 rotate-180 text-emerald-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Content Access Matrix (Decision 38) */}
            {contentAccessResult && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
                <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  مصفوفة الوصول الذكي للمحتوى (Decision 38)
                </h3>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className={`p-3 rounded-xl border text-center ${
                    contentAccessResult.can_view
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <Eye className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">العرض في الفهرس</div>
                    <div className="text-[10px] font-mono mt-0.5">{contentAccessResult.can_view ? 'مسموح' : 'محجوب'}</div>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${
                    contentAccessResult.can_stream
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <Play className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">البث المباشر</div>
                    <div className="text-[10px] font-mono mt-0.5">{contentAccessResult.can_stream ? 'مسموح' : 'ممنوع'}</div>
                  </div>

                  <div className={`p-3 rounded-xl border text-center ${
                    contentAccessResult.can_download
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <Download className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs font-bold">التحميل المحلي</div>
                    <div className="text-[10px] font-mono mt-0.5">{contentAccessResult.can_download ? 'مسموح' : 'غير متاح'}</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">ملف الجودة المخصص (Quality Profile):</span>
                    <strong className="text-amber-400">{contentAccessResult.quality_profile}</strong>
                  </div>

                  <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">التشغيل بمشغل خارجي (VLC / MX):</span>
                    <strong className={contentAccessResult.external_player_allowed ? 'text-emerald-400' : 'text-slate-400'}>
                      {contentAccessResult.external_player_allowed ? 'مسموح' : 'غير متاح'}
                    </strong>
                  </div>

                  <div className="flex justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400">بث للشاشات (Casting / AirPlay):</span>
                    <strong className={contentAccessResult.casting_allowed ? 'text-emerald-400' : 'text-slate-400'}>
                      {contentAccessResult.casting_allowed ? 'مسموح' : 'غير متاح'}
                    </strong>
                  </div>
                </div>

                {contentAccessResult.reasons.length > 0 && (
                  <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                    <div className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      أسباب القيود المطبقة:
                    </div>
                    {contentAccessResult.reasons.map((r, idx) => (
                      <p key={idx} className="text-xs text-rose-300/90 leading-relaxed">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Waterfall Decision Trace (Right Col) */}
          <div className="lg:col-span-8 space-y-6">
            {simulationTrace && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
                {/* Result Banner */}
                <div className={`p-5 rounded-2xl border flex items-center justify-between mb-6 ${
                  simulationTrace.decision
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${
                      simulationTrace.decision ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}>
                      {simulationTrace.decision ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
                        النتيجة النهائية للمحرك (Resolution Result)
                      </div>
                      <div className="text-xl font-bold flex items-center gap-2 mt-0.5">
                        <span>{simulationTrace.decision ? 'تصريح بالوصول (ACCESS GRANTED)' : 'حظر ومنع الوصول (ACCESS DENIED)'}</span>
                      </div>
                      <p className="text-xs opacity-90 mt-1">
                        المستوى الحاسم للقرار: <strong className="underline">{simulationTrace.decision_layer}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono text-xs hidden sm:block">
                    <div className="text-slate-400">رمز الصلاحية:</div>
                    <div className="text-amber-400 font-bold">{simulationTrace.permission_code}</div>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 mb-6 flex items-start gap-2.5">
                  <Terminal className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-white">التعليل البرمجي للقرار: </span>
                    {simulationTrace.reason}
                  </div>
                </div>

                {/* Step-by-Step Waterfall Evaluation (Decision 59) */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    تتبع مستويات التقييم المتسلسلة (Decision 59 Waterfall Trace)
                  </h4>
                  <p className="text-xs text-slate-400 mb-4">
                    يتم فحص كل مستوى بالترتيب بدقة؛ إذا وجد حكم صريح ومطابق يتم البت فيه فوراً:
                  </p>

                  <div className="space-y-3 relative before:absolute before:inset-y-3 before:right-6 before:w-0.5 before:bg-slate-800">
                    {simulationTrace.steps.map((step, idx) => {
                      const isAllow = step.result === 'ALLOW';
                      const isDeny = step.result === 'DENY';
                      const isSkipped = step.result === 'SKIPPED' || step.result === 'DENY (ABSENT)';

                      return (
                        <div
                          key={idx}
                          className={`relative pr-12 p-4 rounded-xl border transition-all ${
                            step.active
                              ? isAllow
                                ? 'bg-emerald-950/20 border-emerald-500/40'
                                : 'bg-rose-950/20 border-rose-500/40'
                              : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                          }`}
                        >
                          {/* Circle dot on timeline */}
                          <div className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            step.active
                              ? isAllow
                                ? 'border-emerald-400 bg-emerald-500 text-white'
                                : 'border-rose-400 bg-rose-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}>
                            {step.active && (
                              isAllow ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-2">
                                <span>{step.layer}</span>
                                {step.active && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    مفعل ومؤثر
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.detail}</p>
                            </div>

                            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex-shrink-0 ${
                              isAllow
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : isDeny
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {step.result}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ROLES & SCOPED ASSIGNMENTS (Decision 37)           */}
      {/* ========================================================= */}
      {activeTab === 'roles-scoped' && (
        <div className="space-y-6">
          {/* Roles Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <div key={role.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{role.code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      role.scope_level === 'GLOBAL'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        : role.scope_level === 'TENANT'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : role.scope_level === 'SITE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      نطاق: {role.scope_level}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">{role.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{role.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>الصلاحيات: <strong className="text-white">{role.permissions_count}</strong></span>
                  <span>{role.is_system ? 'دور نظامي أساسي' : 'دور مخصص'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* User Role Assignments Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  تعيينات الأدوار للمستخدمين بنطاق Global / Tenant / Site
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  التحكم في وصول المستخدمين للأدوار الإدارية وفق قيود النطاق المؤسسي الصارمة
                </p>
              </div>

              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                <Crown className="w-4 h-4" />
                إسناد دور إداري جديد
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 pr-2">المستخدم</th>
                    <th className="pb-3">الدور المسند</th>
                    <th className="pb-3">مستوى النطاق</th>
                    <th className="pb-3">المستأجر (Tenant)</th>
                    <th className="pb-3">الفرع (Site)</th>
                    <th className="pb-3">تاريخ الإسناد</th>
                    <th className="pb-3 text-left pl-2">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {roleAssignments.map(ra => (
                    <tr key={ra.id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-2 font-medium text-white">{ra.user_name}</td>
                      <td className="py-3">
                        <span className="font-semibold text-amber-300">{ra.role_name}</span>
                        <div className="font-mono text-[10px] text-slate-500">{ra.role_code}</div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {ra.role_scope}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300">{ra.tenant_name || '— (شامل)'}</td>
                      <td className="py-3 text-slate-300">{ra.site_name || '— (شامل)'}</td>
                      <td className="py-3 font-mono text-slate-400">{ra.assigned_at}</td>
                      <td className="py-3 text-left pl-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          نشط
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: GROUPS & RESOURCE-LEVEL OVERRIDES                  */}
      {/* ========================================================= */}
      {activeTab === 'permission-groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Permission Groups (Priority-based) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  مجموعات الصلاحيات وأولوياتها (Decision 12 &amp; 37)
                </h3>
                <p className="text-xs text-slate-400 mt-1">تطبق المجموعات قواعد ALLOW و DENY الصريحة حسب أولوية المجموعة</p>
              </div>
            </div>

            <div className="space-y-4">
              {groups.map(grp => (
                <div key={grp.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{grp.name}</h4>
                      <span className="font-mono text-xs text-amber-400">{grp.code}</span>
                    </div>
                    <div className="text-left">
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Priority {grp.priority}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{grp.description}</p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-semibold text-slate-300">القواعد والآثار المحددة:</div>
                    <div className="grid grid-cols-1 gap-1">
                      {grp.permissions.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-300">{p.permission_name || p.permission_code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            p.effect === 'ALLOW'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {p.effect}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resource-Level Overrides (Decision 37) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  استثناءات الموارد المباشرة (Resource-Level Overrides)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  منح أو حظر مادة معينة بعينها لمستخدم بعينه تجاوزاً لقواعد المجموعة أو البروفايل
                </p>
              </div>

              <button
                onClick={() => setShowOverrideModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
              >
                استثناء مخصص
              </button>
            </div>

            <div className="space-y-3">
              {resourceOverrides.map(rpo => (
                <div key={rpo.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white">{rpo.user_name}</span>
                      <div className="text-xs text-amber-400 font-medium">{rpo.resource_name || rpo.resource_id}</div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      rpo.is_granted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {rpo.is_granted ? 'منح استثنائي' : 'حظر استثنائي'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-300 font-medium">السبب: </span>
                    {rpo.reason}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 font-mono">
                    <span>الصلاحية: {rpo.permission_code}</span>
                    <span>الانتهاء: {rpo.expires_at || 'دائم'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PERMISSIONS CATALOG (34+ Phase 3 Permissions)      */}
      {/* ========================================================= */}
      {activeTab === 'permissions-catalog' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث بكود الصلاحية، الاسم، أو الوصف..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {['all', 'content', 'playback', 'features', 'admin', 'system'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCatalogCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    catalogCategory === cat
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat === 'all' ? 'الكل' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Permissions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(p => (
              <div key={p.code} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-amber-400 font-bold">{p.code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {p.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1.5">{p.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{p.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Resource: {p.resource_type || 'SYSTEM'}</span>
                  <span>Action: {p.action || 'view'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: REDIS CACHING & AUDIT ENGINE                       */}
      {/* ========================================================= */}
      {activeTab === 'redis-audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              الذاكرة المؤقتة للصلاحيات (Redis Permission Cache)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              لتسريع فحص التصاريح داخل شبكة الاستراحة المحلية واستبعاد أي استعلام متكرر لقاعدة البيانات،
              يتم حفظ شجرة الصلاحيات المحسوبة وفق مفتاح مركب <code className="text-amber-400 font-mono">lounge:perms:&#123;user_id&#125;:&#123;tenant&#125;:&#123;site&#125;</code> مع TTL محدد.
            </p>

            <div className="space-y-3 pt-2">
              {(Object.entries(cacheStatus) as [string, { hits: number; ttl: number; state: 'CACHED' | 'INVALIDATED' }][]).map(([key, info]) => (
                <div key={key} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-300 break-all">{key}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      info.state === 'CACHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {info.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-400 font-mono">
                    <div>Hits: <strong className="text-white">{info.hits} reqs</strong></div>
                    <div>TTL: <strong className="text-emerald-400">{info.ttl}s</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleInvalidateCache()}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              تنفيذ Invalidation فوري لمفاتيح Redis
            </button>
          </div>

          <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              سجل تدقيق القرارات الحساسة (Audit Log)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تسجيل كافة عمليات منح الأدوار، التعيينات النطاقية، وتجاوزات الموارد لضمان التوافق الأمني:
            </p>

            <div className="space-y-2.5">
              {[
                { time: 'منذ 3 دقائق', user: 'م. أحمد الشمري', action: 'ROLE_ASSIGNMENT', detail: 'إسناد دور SITE_MANAGER إلى خالد التميمي في فرع العليا' },
                { time: 'منذ 15 دقيقة', user: 'نظام الاستراحة', action: 'CACHE_INVALIDATION', detail: 'إبطال كاش الصلاحيات للمستخدم LU-000152 بعد تعديل البروفايل' },
                { time: 'منذ ساعة', user: 'سارة الدوسري', action: 'RESOURCE_OVERRIDE', detail: 'منح تصريح مؤقت لفيلم Dune 2 للعميل فهد العتيبي' },
              ].map((log, lIdx) => (
                <div key={lIdx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-amber-300">{log.action}</span>
                    <span className="font-mono text-[11px]">{log.time}</span>
                  </div>
                  <p className="text-slate-300">{log.detail}</p>
                  <div className="text-[10px] text-slate-500">المُنفذ: {log.user}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ASSIGN ROLE WITH SCOPE ENFORCEMENT                 */}
      {/* ========================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                إسناد دور إداري مع تطبيق قيود النطاق
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoleAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">المستخدم المستهدف</label>
                <select
                  value={newAssignUserId}
                  onChange={(e) => setNewAssignUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.lounge_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">الدور المراد إسناده</label>
                <select
                  value={newAssignRoleCode}
                  onChange={(e) => setNewAssignRoleCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {roles.filter(r => r.is_assignable).map(r => (
                    <option key={r.code} value={r.code}>{r.name} (نطاق: {r.scope_level})</option>
                  ))}
                </select>
              </div>

              {/* Scope-specific inputs */}
              {roles.find(r => r.code === newAssignRoleCode)?.scope_level === 'TENANT' && (
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">اسم المستأجر (مطلوب)</label>
                  <input
                    type="text"
                    value={newAssignTenant}
                    onChange={(e) => setNewAssignTenant(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    placeholder="مثلاً: شركة الاستراحات الموحدة"
                    required
                  />
                </div>
              )}

              {roles.find(r => r.code === newAssignRoleCode)?.scope_level === 'SITE' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">المستأجر التابع له</label>
                    <input
                      type="text"
                      value={newAssignTenant}
                      onChange={(e) => setNewAssignTenant(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 mb-1 block">اسم الفرع / الموقع (مطلوب)</label>
                    <input
                      type="text"
                      value={newAssignSite}
                      onChange={(e) => setNewAssignSite(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                      placeholder="مثلاً: فرع العليا - صالة النخبة"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  حفظ وتفعيل الدور فورياً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE RESOURCE OVERRIDE                           */}
      {/* ========================================================= */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                إضافة استثناء على مستوى مورد محدد (Decision 37)
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateResourceOverride} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">المستخدم</label>
                <select
                  value={overrideUserId}
                  onChange={(e) => setOverrideUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.lounge_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">المادة الإعلامية المستهدفة</label>
                <select
                  value={overrideMediaId}
                  onChange={(e) => setOverrideMediaId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {mediaItems.map(m => (
                    <option key={m.id} value={m.id}>{m.title} {m.is_premium ? '(VIP)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">نوع الاستثناء</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOverrideGranted(true)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      overrideGranted
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    منح استثنائي (ALLOW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideGranted(false)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      !overrideGranted
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    حظر استثنائي (DENY)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">سبب الاستثناء (للتدقيق الأمني)</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  placeholder="سبب واضح وموثق..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  تطبيق الاستثناء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
