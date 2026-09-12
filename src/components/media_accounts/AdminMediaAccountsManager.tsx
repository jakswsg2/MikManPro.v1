import React, { useState } from 'react';
import {
  Users,
  Activity,
  UserX,
  Server,
  Layers,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { AdminMediaAccountsGrid } from './AdminMediaAccountsGrid';
import { ProvisioningDashboard } from './ProvisioningDashboard';
import { OrphanUsersPage } from './OrphanUsersPage';
import { mediaAccountEngine } from '../../services/mediaAccountEngine';

interface Props {
  onBack?: () => void;
}

export const AdminMediaAccountsManager: React.FC<Props> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'dashboard' | 'orphans'>('mappings');

  const orphansCount = mediaAccountEngine.getOrphans(undefined, 'NEW').length;

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* Top Breadcrumb & Title Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
              Phase 10 • Architecture Decision 11 & 18
            </span>
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
              Multi-Tenant LAN Media
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-600" />
            نظام إدارة وتزويد حسابات خوادم الوسائط (Jellyfin / Emby)
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            التحكم المركزي في إنشاء الحسابات، تشفير كلمات المرور (Fernet)، تطبيق سياسات المشاهدة، كشف الحسابات المنفصلة (Orphans)، ومزامنة الهويات بين Smart Lounge والخوادم المحلية.
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="self-start md:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          onClick={() => setActiveTab('mappings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'mappings'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          الحسابات المربوطة (Account Mappings)
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'dashboard'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          لوحة التزويد والتزامن (Provisioning & Sync)
        </button>

        <button
          onClick={() => setActiveTab('orphans')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'orphans'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>الحسابات المنفصلة (Orphans)</span>
          {orphansCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'orphans'
                  ? 'bg-white text-indigo-600'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {orphansCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'mappings' && <AdminMediaAccountsGrid />}
        {activeTab === 'dashboard' && <ProvisioningDashboard />}
        {activeTab === 'orphans' && <OrphanUsersPage />}
      </div>
    </div>
  );
};
