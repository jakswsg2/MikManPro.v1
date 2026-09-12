import React, { useState } from 'react';
import { MultiTenantEngine, ProvisionTenantInput } from '../../services/tenantEngine';
import { Tenant, TenantStatus, TenantPlan, CrossTenantAuditAttempt } from '../../types';
import { 
  Building2, 
  Plus, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  Layers, 
  Key, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  PauseCircle, 
  PlayCircle, 
  Archive, 
  MapPin, 
  Server, 
  Users, 
  Sliders, 
  Activity, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface SuperAdminTenantsViewProps {
  currentUser?: any;
  t?: (key: string) => string;
}

export const SuperAdminTenantsView: React.FC<SuperAdminTenantsViewProps> = ({ currentUser }) => {
  const [tenants, setTenants] = useState<Tenant[]>(MultiTenantEngine.getAllTenants());
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Provisioning Modal State
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{
    tenant: Tenant;
    admin_password_revealed: string;
    admin_user: any;
    default_site: any;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Form State
  const [newTenantForm, setNewTenantForm] = useState<ProvisionTenantInput>({
    name: '',
    name_ar: '',
    name_en: '',
    slug: '',
    admin_email: '',
    admin_username: 'admin',
    admin_full_name: '',
    admin_password: '',
    plan: 'STANDARD',
    contact_phone: '+967 7',
    address: 'صنعاء',
    country: 'YE',
    default_language: 'ar',
    max_users: 200,
    max_sites: 3,
    max_media_servers: 3,
    initial_site_name: 'الفرع الرئيسي'
  });

  // Cross-tenant audits
  const [audits, setAudits] = useState<CrossTenantAuditAttempt[]>(MultiTenantEngine.getCrossTenantAudits());
  const [activeTab, setActiveTab] = useState<'tenants' | 'audits' | 'metrics'>('tenants');

  const refreshData = () => {
    setTenants(MultiTenantEngine.getAllTenants());
    setAudits(MultiTenantEngine.getCrossTenantAudits());
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.contact_email && t.contact_email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesPlan = planFilter === 'ALL' || t.subscription_plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantForm.name || !newTenantForm.slug || !newTenantForm.admin_email) return;

    try {
      const result = MultiTenantEngine.provisionTenant(newTenantForm);
      setProvisionResult({
        tenant: result.tenant,
        admin_password_revealed: result.admin_password_revealed,
        admin_user: result.admin_user,
        default_site: result.default_site
      });
      refreshData();
      setIsProvisionModalOpen(false);
      // Reset form
      setNewTenantForm({
        name: '',
        name_ar: '',
        name_en: '',
        slug: '',
        admin_email: '',
        admin_username: 'admin',
        admin_full_name: '',
        admin_password: '',
        plan: 'STANDARD',
        contact_phone: '+967 7',
        address: 'صنعاء',
        country: 'YE',
        default_language: 'ar',
        max_users: 200,
        max_sites: 3,
        max_media_servers: 3,
        initial_site_name: 'الفرع الرئيسي'
      });
    } catch (err: any) {
      alert(`فشل إنشاء المستأجر: ${err.message}`);
    }
  };

  const handleToggleStatus = (tenant: Tenant, newStatus: TenantStatus) => {
    const reason = newStatus === 'SUSPENDED' ? prompt('سبب تعليق المستأجر:') || 'Administrative policy suspension' : undefined;
    MultiTenantEngine.setTenantStatus(tenant.id, newStatus, reason);
    refreshData();
    if (selectedTenant && selectedTenant.id === tenant.id) {
      setSelectedTenant(MultiTenantEngine.getTenantById(tenant.id) || null);
    }
  };

  const handleImpersonate = (tenant: Tenant) => {
    MultiTenantEngine.setTenantOverride(tenant.id);
    refreshData();
    alert(`تم تفعيل محاكاة السياق كـ Superuser للمستأجر: ${tenant.name} (${tenant.code}).\nتم تطبيق X-Tenant-Override وتحديث إعدادات الهوية البصرية.`);
  };

  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold">
                Phase 8 • Multi-Tenant &amp; Database RLS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
                PostgreSQL Row-Level Security Enforced
              </span>
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-amber-400" />
              <span>إدارة المستأجرين والعزل الصارم (Multi-Tenant Management)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              لوحة التحكم الشاملة لـ Super Admin لإدارة الاستراحات والفنادق المشتركة في المنصة، وإنشاء المستأجرين الجدد بشكل ذري مع عزل كامل على مستوى قاعدة البيانات PostgreSQL Row-Level Security.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProvisionModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مستأجر جديد (Provision Tenant)</span>
            </button>
          </div>
        </div>

        {/* Global Multi-Tenant Metrics Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">إجمالي المستأجرين (Tenants)</span>
            <span className="text-xl font-black text-white">{tenants.length}</span>
            <span className="text-[10px] text-emerald-400 block font-mono mt-0.5">
              {tenants.filter(t => t.status === 'ACTIVE').length} نشط • {tenants.filter(t => t.status === 'PROVISIONING').length} قيد التهيئة
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">إجمالي الفروع والمواقع (Sites)</span>
            <span className="text-xl font-black text-amber-400">{MultiTenantEngine.getAllSites().length}</span>
            <span className="text-[10px] text-slate-400 block font-mono mt-0.5">مواقع ومناطق معزولة</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">سياسات RLS وقواعد العزل</span>
            <span className="text-xl font-black text-emerald-400">100% FORCE RLS</span>
            <span className="text-[10px] text-emerald-400 block font-mono mt-0.5">Deny by Default Active</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">تنبيهات محاولات Cross-Tenant</span>
            <span className={`text-xl font-black ${audits.length > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {audits.length}
            </span>
            <span className="text-[10px] text-rose-400 block font-mono mt-0.5">Blocked &amp; Audited</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'tenants'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>قائمة المستأجرين ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'audits'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>سجل تدقيق محاولات Cross-Tenant ({audits.length})</span>
        </button>
      </div>

      {/* Tab 1: Tenants Directory */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المستأجر، الكود (TNT-...)، أو الـ Slug..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="ACTIVE">نشط (ACTIVE)</option>
                <option value="PROVISIONING">قيد التهيئة (PROVISIONING)</option>
                <option value="SUSPENDED">معلق (SUSPENDED)</option>
                <option value="ARCHIVED">مؤرشف (ARCHIVED)</option>
              </select>

              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">جميع الخطط</option>
                <option value="ENTERPRISE">Enterprise</option>
                <option value="STANDARD">Standard</option>
                <option value="BASIC">Basic</option>
                <option value="FREE">Free</option>
              </select>
            </div>
          </div>

          {/* Tenants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenants.map((t) => {
              const sites = MultiTenantEngine.getSitesForTenant(t.id);
              const isCurrentActive = MultiTenantEngine.getActiveTenant().id === t.id;

              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isCurrentActive
                      ? 'bg-slate-900/90 border-amber-500/50 shadow-lg shadow-amber-500/5'
                      : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Top Info */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-950 shrink-0"
                          style={{ backgroundColor: t.branding?.primary_color || '#f59e0b' }}
                        />
                        <div>
                          <h3 className="font-bold text-sm text-white line-clamp-1">{t.name}</h3>
                          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="text-amber-400 font-bold">{t.code}</span>
                            <span>•</span>
                            <span>{t.slug}</span>
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        t.status === 'ACTIVE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : t.status === 'PROVISIONING'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : t.status === 'SUSPENDED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    {/* Metadata & Limits */}
                    <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الخطة</span>
                        <span className="text-xs font-bold text-amber-300 font-mono">{t.subscription_plan}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المواقع (Sites)</span>
                        <span className="text-xs font-bold text-white font-mono">{sites.length} / {t.max_sites || 5}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المستخدمون</span>
                        <span className="text-xs font-bold text-white font-mono">max {t.max_users || 100}</span>
                      </div>
                    </div>

                    {/* Sites Preview List */}
                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        الفروع المسجلة:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {sites.map(s => (
                          <span
                            key={s.id}
                            className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px] text-slate-300 flex items-center gap-1"
                          >
                            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {t.suspend_reason && (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 mb-3">
                        <span className="font-bold">سبب التعليق: </span>
                        {t.suspend_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedTenant(t)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-400" />
                      <span>تفاصيل وإعدادات</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleImpersonate(t)}
                        title="محاكاة سياق هذا المستأجر كـ Superuser (X-Tenant-Override)"
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>محاكاة</span>
                      </button>

                      {t.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleToggleStatus(t, 'SUSPENDED')}
                          title="تعليق المستأجر"
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 border border-slate-700 transition-colors"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(t, 'ACTIVE')}
                          title="استئناف نشاط المستأجر"
                          className="p-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Cross-Tenant Security Audit */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <span className="font-bold block">مراقبة محاولات الاختراق وعمليات Cross-Tenant Queries:</span>
                <span>أي استعلام مباشر أو طلب API يحاول الوصول لمورد مستأجر آخر يتم رفضه وتوثيقه تلقائياً عبر PostgreSQL RLS و TenantMiddleware.</span>
              </div>
            </div>
            <button
              onClick={() => {
                MultiTenantEngine.clearCrossTenantAudits();
                refreshData();
              }}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold"
            >
              مسح السجل
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold font-mono">
                    <th className="p-3.5">الوقت والتاريخ</th>
                    <th className="p-3.5">المستخدم الفاعل (Actor)</th>
                    <th className="p-3.5">مستأجر الفاعل</th>
                    <th className="p-3.5">المستأجر المستهدف</th>
                    <th className="p-3.5">نوع المورد والعملية</th>
                    <th className="p-3.5">النتيجة</th>
                    <th className="p-3.5">التفاصيل المعمارية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audits.map((audit) => (
                    <tr key={audit.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(audit.timestamp).toLocaleTimeString('ar-YE')}
                        <span className="block text-[10px] text-slate-400">
                          {new Date(audit.timestamp).toLocaleDateString('ar-YE')}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-white whitespace-nowrap">
                        {audit.actor_name}
                        <span className="block font-mono text-[10px] text-slate-400">{audit.ip_address}</span>
                      </td>
                      <td className="p-3.5 text-slate-300 font-mono">
                        {audit.actor_tenant_name || audit.actor_tenant_id}
                      </td>
                      <td className="p-3.5 font-bold text-rose-400 font-mono">
                        {audit.target_tenant_name || audit.target_tenant_id}
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-slate-200 font-bold block">{audit.resource_type}</span>
                        <span className="font-mono text-[10px] text-slate-400">{audit.action}</span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono font-bold text-[10px] border border-rose-500/30">
                          {audit.result}
                        </span>
                      </td>
                      <td className="p-3.5 text-[11px] text-slate-400 max-w-xs">
                        {audit.details?.reason || audit.details?.message || JSON.stringify(audit.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Provisioning Modal (Step-by-step Atomic Wizard) */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">
                  تهيئة مستأجر جديد (Atomic Tenant Provisioning)
                </h3>
              </div>
              <button
                onClick={() => setIsProvisionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم المستأجر (العربي) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTenantForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || 'tenant';
                      setNewTenantForm({ ...newTenantForm, name, slug });
                    }}
                    placeholder="مثال: استراحة النورس الذكية"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    معرف الـ Slug (فريد للرابط) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTenantForm.slug}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, slug: e.target.value.toLowerCase() })}
                    placeholder="al-nawras"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    باقة الاشتراك (Plan)
                  </label>
                  <select
                    value={newTenantForm.plan}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, plan: e.target.value as TenantPlan })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="BASIC">Basic (50 مستخدم)</option>
                    <option value="STANDARD">Standard (200 مستخدم)</option>
                    <option value="ENTERPRISE">Enterprise (1000 مستخدم)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    اسم الفرع الافتراضي الأول
                  </label>
                  <input
                    type="text"
                    value={newTenantForm.initial_site_name}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, initial_site_name: e.target.value })}
                    placeholder="الفرع الرئيسي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={newTenantForm.contact_phone}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, contact_phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>بيانات حساب المدير الافتراضي (Tenant Admin):</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">اسم المشرف بالكامل</label>
                    <input
                      type="text"
                      required
                      value={newTenantForm.admin_full_name}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_full_name: e.target.value })}
                      placeholder="م. عبد الرحمن الأحمدي"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">البريد الإلكتروني للإدارة *</label>
                    <input
                      type="email"
                      required
                      value={newTenantForm.admin_email}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_email: e.target.value })}
                      placeholder="admin@lounge.lan"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">اسم المستخدم (Username)</label>
                    <input
                      type="text"
                      required
                      value={newTenantForm.admin_username}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_username: e.target.value })}
                      placeholder="admin"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">كلمة المرور (اتركها فارغة للتوليد التلقائي)</label>
                    <input
                      type="password"
                      value={newTenantForm.admin_password}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_password: e.target.value })}
                      placeholder="توليد عشوائي آمن"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20"
                >
                  تأكيد وإنشاء المستأجر (Provision)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single-Reveal Password & Provision Success Modal */}
      {provisionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle2 className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-lg font-black text-white">
                  تم إنشاء المستأجر بنجاح وتجهيز قواعد RLS!
                </h3>
                <span className="text-xs text-emerald-400 font-mono">
                  Tenant ID: {provisionResult.tenant.code} ({provisionResult.tenant.slug})
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>احفظ بيانات الدخول الآن — كلمة المرور تظهر مرة واحدة فقط:</span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">اسم المستخدم: </span>
                  <span className="text-white font-bold">{provisionResult.admin_user.username}</span>
                </div>
                <div>
                  <span className="text-slate-400">البريد الإلكتروني: </span>
                  <span className="text-slate-300">{provisionResult.admin_user.email}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <div>
                    <span className="text-slate-400">كلمة المرور المولدة: </span>
                    <span className="text-amber-400 font-bold text-sm select-all">
                      {provisionResult.admin_password_revealed}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCredentials(`اسم المستخدم: ${provisionResult.admin_user.username}\nكلمة المرور: ${provisionResult.admin_password_revealed}\nكود المستأجر: ${provisionResult.tenant.code}`)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    {copiedPassword ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setProvisionResult(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
            >
              تم حفظ البيانات والمتابعة
            </button>
          </div>
        </div>
      )}

      {/* Selected Tenant Details Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-slate-950"
                  style={{ backgroundColor: selectedTenant.branding?.primary_color || '#f59e0b' }}
                />
                <h3 className="font-bold text-base text-white">
                  تفاصيل المستأجر: {selectedTenant.name} ({selectedTenant.code})
                </h3>
              </div>
              <button
                onClick={() => setSelectedTenant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* General Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">الـ Slug / معرّف المسار</span>
                <span className="text-amber-300 font-mono font-bold">{selectedTenant.slug}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">خطة الاشتراك</span>
                <span className="text-white font-mono font-bold">{selectedTenant.subscription_plan}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">بريد الاتصال</span>
                <span className="text-slate-300 font-mono">{selectedTenant.contact_email || 'غير محدد'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px]">تاريخ التفعيل</span>
                <span className="text-slate-300 font-mono">
                  {selectedTenant.activated_at ? new Date(selectedTenant.activated_at).toLocaleDateString('ar-YE') : '—'}
                </span>
              </div>
            </div>

            {/* Sites */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>الفروع والمواقع التابعة (Sites):</span>
              </h4>
              <div className="space-y-1.5">
                {MultiTenantEngine.getSitesForTenant(selectedTenant.id).map(s => (
                  <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white">{s.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 mr-2">({s.code} • {s.site_type})</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                      سعة {s.capacity || 50} جهاز
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => handleImpersonate(selectedTenant)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>محاكاة المستأجر الآن (X-Tenant-Override)</span>
              </button>

              <button
                onClick={() => setSelectedTenant(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
