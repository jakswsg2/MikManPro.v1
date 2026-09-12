import React, { useState } from 'react';
import { MultiTenantEngine } from '../../services/tenantEngine';
import { Tenant, Site, SiteType, SiteIsolationMode, TenantSettings, TenantBranding } from '../../types';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Sliders, 
  Palette, 
  Users, 
  Check, 
  Save, 
  Sparkles, 
  ShieldCheck, 
  Smartphone, 
  Film, 
  Globe, 
  Clock,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';

interface TenantAdminDashboardProps {
  currentUser?: any;
}

export const TenantAdminDashboard: React.FC<TenantAdminDashboardProps> = () => {
  const activeTenant = MultiTenantEngine.getActiveTenant();
  const [activeTab, setActiveTab] = useState<'settings' | 'sites' | 'branding'>('settings');
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(activeTenant.settings || {});
  const [tenantBranding, setTenantBranding] = useState<TenantBranding>(activeTenant.branding || {
    primary_color: '#f59e0b',
    secondary_color: '#0f172a',
    app_name: activeTenant.name,
    app_subtitle: 'البوابة المركزية لبث الوسائط والإنترنت المحلي'
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sites state
  const [sites, setSites] = useState<Site[]>(MultiTenantEngine.getSitesForTenant(activeTenant.id));
  const [isNewSiteModalOpen, setIsNewSiteModalOpen] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState<{
    name: string;
    code: string;
    site_type: SiteType;
    capacity: number;
    address: string;
    city: string;
    contact_person: string;
    contact_phone: string;
  }>({
    name: '',
    code: 'SITE-02',
    site_type: 'LOUNGE',
    capacity: 100,
    address: '',
    city: 'صنعاء',
    contact_person: '',
    contact_phone: '+967 7'
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    MultiTenantEngine.updateTenantSettings(activeTenant.id, tenantSettings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    MultiTenantEngine.updateTenantBranding(activeTenant.id, tenantBranding);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteForm.name) return;

    MultiTenantEngine.createSite({
      tenant_id: activeTenant.id,
      name: newSiteForm.name,
      code: newSiteForm.code,
      site_type: newSiteForm.site_type,
      capacity: newSiteForm.capacity,
      address: newSiteForm.address,
      city: newSiteForm.city,
      contact_person: newSiteForm.contact_person,
      contact_phone: newSiteForm.contact_phone
    });

    setSites(MultiTenantEngine.getSitesForTenant(activeTenant.id));
    setIsNewSiteModalOpen(false);
    setNewSiteForm({
      name: '',
      code: `SITE-0${sites.length + 2}`,
      site_type: 'LOUNGE',
      capacity: 100,
      address: '',
      city: 'صنعاء',
      contact_person: '',
      contact_phone: '+967 7'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-950 font-black text-lg shadow-lg"
            style={{ backgroundColor: tenantBranding.primary_color || '#f59e0b' }}
          >
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">{activeTenant.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                {activeTenant.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              لوحة تحكم المشرف لإدارة إعدادات الاستراحة، المواقع والفروع، والهوية البصرية المعزولة.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-scale-up">
            <Check className="w-4 h-4" />
            <span>تم حفظ التغييرات بنجاح</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>سياسات وإعدادات الاستراحة</span>
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'sites'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>إدارة الفروع والمواقع ({sites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'branding'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>الهوية البصرية والمظهر (Branding)</span>
        </button>
      </div>

      {/* Tab 1: Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 max-w-3xl">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>سياسات الجلسات والأجهزة (Session Policies):</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  الحد الأقصى للأجهزة المتزامنة لكل مستخدم
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tenantSettings.max_concurrent_sessions || 3}
                  onChange={(e) => setTenantSettings({ ...tenantSettings, max_concurrent_sessions: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  مدة انتهاء الجلسة التلقائية (بالدقائق)
                </label>
                <input
                  type="number"
                  min="30"
                  max="2880"
                  value={tenantSettings.session_ttl_minutes || 480}
                  onChange={(e) => setTenantSettings({ ...tenantSettings, session_ttl_minutes: parseInt(e.target.value) || 480 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                نمط عزل المواقع الداخلية (Site Isolation Policy)
              </label>
              <select
                value={tenantSettings.site_isolation || 'NONE'}
                onChange={(e) => setTenantSettings({ ...tenantSettings, site_isolation: e.target.value as SiteIsolationMode })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="NONE">مشاركة كاملة (NONE) — جميع فروع المستأجر تشترك في المحتوى والمستخدمين</option>
                <option value="SHARED_MEDIA">مشاركة مكتبات الوسائط فقط (SHARED_MEDIA) — جلسات ومستخدمي الفروع معزولة</option>
                <option value="STRICT">عزل صارم بين الفروع (STRICT) — كل فرع يرى مستخدميه وخوادمه فقط</option>
              </select>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-400" />
              <span>سياسات البث والتحميل (Media &amp; Bandwidth):</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  أقصى معدل بت للمشتركين (Bitrate Cap - Mbps)
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={tenantSettings.max_bitrate_mbps || 50}
                  onChange={(e) => setTenantSettings({ ...tenantSettings, max_bitrate_mbps: parseInt(e.target.value) || 50 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اللغة الافتراضية للواجهة
                </label>
                <select
                  value={tenantSettings.default_language || 'ar'}
                  onChange={(e) => setTenantSettings({ ...tenantSettings, default_language: e.target.value as 'ar' | 'en' })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-300 font-bold">السماح بتحميل المحتوى للأجهزة (Download)</span>
              <button
                type="button"
                onClick={() => setTenantSettings({ ...tenantSettings, allow_downloads: !tenantSettings.allow_downloads })}
                className="text-amber-400"
              >
                {tenantSettings.allow_downloads ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7 text-slate-500" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>حفظ إعدادات المستأجر</span>
          </button>
        </form>
      )}

      {/* Tab 2: Sites Management */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>فروع ومواقع الاستراحة المسجلة:</span>
            </h3>

            <button
              onClick={() => setIsNewSiteModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فرع جديد (Add Site)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sites.map((s) => (
              <div key={s.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{s.name}</h4>
                    <span className="text-xs font-mono text-amber-400">{s.code} • {s.site_type}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">السعة الاستيعابية</span>
                    <span className="font-bold text-white font-mono">{s.capacity || 50} جهاز</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">المدينة / الموقع</span>
                    <span className="font-bold text-slate-300">{s.city || s.address || 'صنعاء'}</span>
                  </div>
                </div>

                {s.contact_person && (
                  <div className="text-[11px] text-slate-400">
                    <span>المسؤول: </span>
                    <span className="text-slate-200 font-bold">{s.contact_person}</span> ({s.contact_phone})
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Branding */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBranding} className="space-y-4 max-w-3xl">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              <span>تخصيص الهوية البصرية وشعار الاستراحة:</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اسم التطبيق المخصص للواجهة
                </label>
                <input
                  type="text"
                  value={tenantBranding.app_name}
                  onChange={(e) => setTenantBranding({ ...tenantBranding, app_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  الوصف أو الشعار الفرعي
                </label>
                <input
                  type="text"
                  value={tenantBranding.app_subtitle || ''}
                  onChange={(e) => setTenantBranding({ ...tenantBranding, app_subtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  اللون الأساسي للعلامة (Primary Color)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tenantBranding.primary_color}
                    onChange={(e) => setTenantBranding({ ...tenantBranding, primary_color: e.target.value })}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-slate-950 border border-slate-800 p-1"
                  />
                  <input
                    type="text"
                    value={tenantBranding.primary_color}
                    onChange={(e) => setTenantBranding({ ...tenantBranding, primary_color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رابط الشعار المخصص (Logo URL)
                </label>
                <input
                  type="url"
                  value={tenantBranding.logo_url || ''}
                  onChange={(e) => setTenantBranding({ ...tenantBranding, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">معاينة مباشرة للبطاقة:</span>
              <div className="p-4 rounded-xl flex items-center justify-between" style={{ backgroundColor: '#090d16', border: `1px solid ${tenantBranding.primary_color}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-slate-950" style={{ backgroundColor: tenantBranding.primary_color }}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">{tenantBranding.app_name}</h4>
                    <span className="text-xs text-slate-400">{tenantBranding.app_subtitle}</span>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-lg text-slate-950 font-bold text-xs" style={{ backgroundColor: tenantBranding.primary_color }}>
                  مشاهدة الآن
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>تطبيق وتحديث الهوية</span>
          </button>
        </form>
      )}

      {/* New Site Modal */}
      {isNewSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span>إضافة فرع / موقع جديد</span>
            </h3>

            <form onSubmit={handleCreateSite} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم الموقع *</label>
                <input
                  type="text"
                  required
                  value={newSiteForm.name}
                  onChange={(e) => setNewSiteForm({ ...newSiteForm, name: e.target.value })}
                  placeholder="مثال: صالة الألعاب الإلكترونية"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">كود الموقع</label>
                  <input
                    type="text"
                    required
                    value={newSiteForm.code}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع الموقع</label>
                  <select
                    value={newSiteForm.site_type}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, site_type: e.target.value as SiteType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="LOUNGE">صالة استراحة (Lounge)</option>
                    <option value="HOTEL">فندق / منتجع (Hotel)</option>
                    <option value="CAFE">كافيه إنترنت (Cafe)</option>
                    <option value="OFFICE">مكتب / شركة (Office)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">السعة (أجهزة)</label>
                  <input
                    type="number"
                    value={newSiteForm.capacity}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, capacity: parseInt(e.target.value) || 50 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المدينة</label>
                  <input
                    type="text"
                    value={newSiteForm.city}
                    onChange={(e) => setNewSiteForm({ ...newSiteForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSiteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black"
                >
                  إضافة الفرع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
