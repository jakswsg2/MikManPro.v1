import React, { useState } from 'react';
import { MultiTenantEngine } from '../../services/tenantEngine';
import { Tenant, Site } from '../../types';
import { 
  Building2, 
  ChevronDown, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  MapPin, 
  Check, 
  UserCheck, 
  ArrowRightLeft,
  XCircle,
  ExternalLink
} from 'lucide-react';

interface TenantSwitcherProps {
  onOpenTenantsManagement?: () => void;
  onOpenRLSSandbox?: () => void;
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({
  onOpenTenantsManagement,
  onOpenRLSSandbox
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeTenant = MultiTenantEngine.getActiveTenant();
  const allTenants = MultiTenantEngine.getAllTenants();
  const tenantSites = MultiTenantEngine.getSitesForTenant(activeTenant.id);
  const activeSite = MultiTenantEngine.getActiveSite();
  const overrideTenantId = MultiTenantEngine.getOverrideTenantId();

  const handleSelectTenant = (t: Tenant) => {
    MultiTenantEngine.setActiveTenant(t.id);
    setIsOpen(false);
  };

  const handleSelectSite = (s: Site) => {
    MultiTenantEngine.setActiveSite(s.id);
    setIsOpen(false);
  };

  const handleClearOverride = () => {
    MultiTenantEngine.setTenantOverride(null);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-right">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
          overrideTenantId
            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200 hover:bg-slate-800/80'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full ring-2 ring-slate-900"
            style={{ backgroundColor: activeTenant.branding?.primary_color || '#f59e0b' }}
          />
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold max-w-[140px] truncate">
            {activeTenant.name}
          </span>
        </div>

        <span className="px-1.5 py-0.5 rounded bg-slate-950/80 text-[10px] font-mono text-slate-400 border border-slate-800">
          {activeTenant.code}
        </span>

        {activeSite && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 border-r border-slate-700 pr-2 mr-1">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span className="max-w-[90px] truncate">{activeSite.name}</span>
          </span>
        )}

        {overrideTenantId && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[9px] animate-pulse">
            X-Tenant-Override
          </span>
        )}

        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-950/80 p-3 z-50 animate-scale-up">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>مستأجرو المنصة وسياق الـ DB (Tenant Context)</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              RLS Active
            </span>
          </div>

          {/* Override Warning if Active */}
          {overrideTenantId && (
            <div className="my-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>أنت تعمل الآن بمحاكاة سياق مستأجر كـ Superuser</span>
              </div>
              <button
                onClick={handleClearOverride}
                className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400 transition-colors"
              >
                إنهاء
              </button>
            </div>
          )}

          {/* Tenants List */}
          <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            <div className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">
              المستأجرون المسجلون (Tenants):
            </div>
            {allTenants.map((t) => {
              const isSelected = t.id === activeTenant.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTenant(t)}
                  className={`w-full p-2 rounded-xl text-right border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-white'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-950"
                      style={{ backgroundColor: t.branding?.primary_color || '#f59e0b' }}
                    />
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{t.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({t.code})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {t.slug} • {t.subscription_plan}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sites within this Tenant */}
          {tenantSites.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 px-1 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span>فروع ومواقع هذا المستأجر (Sites):</span>
                <span className="text-[9px] font-mono text-slate-400">{tenantSites.length} موقع</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {tenantSites.map((s) => {
                  const isSiteSelected = s.id === activeSite?.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSite(s)}
                      className={`p-1.5 rounded-lg border text-right text-[11px] transition-all flex items-center justify-between ${
                        isSiteSelected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      {isSiteSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fast Navigation Buttons */}
          <div className="mt-3 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
            {onOpenTenantsManagement && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenTenantsManagement();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>إدارة المستأجرين</span>
              </button>
            )}

            {onOpenRLSSandbox && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenRLSSandbox();
                }}
                className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 font-bold transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                <span>مختبر أمان RLS</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
