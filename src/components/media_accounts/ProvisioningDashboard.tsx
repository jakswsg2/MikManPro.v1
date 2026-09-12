import React, { useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Server,
  Zap,
  Clock,
  Check,
  ShieldCheck
} from 'lucide-react';
import { mediaAccountEngine } from '../../services/mediaAccountEngine';
import { ProvisioningConfig, ProvisioningDashboardMetrics, MediaServerUserSync } from '../../types';

export const ProvisioningDashboard: React.FC = () => {
  const [selectedServerId, setSelectedServerId] = useState<string>('srv-lan-jellyfin-01');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [configModal, setConfigModal] = useState<{
    isOpen: boolean;
    config?: ProvisioningConfig;
  }>({
    isOpen: false
  });

  const servers = useMemo(() => mediaAccountEngine.getServers(), [refreshTrigger]);
  const currentServer = useMemo(
    () => servers.find(s => s.id === selectedServerId) || servers[0],
    [servers, selectedServerId]
  );

  const metrics: ProvisioningDashboardMetrics = useMemo(() => {
    return mediaAccountEngine.getDashboardMetrics(selectedServerId);
  }, [selectedServerId, refreshTrigger]);

  const syncHistory: MediaServerUserSync[] = useMemo(() => {
    return mediaAccountEngine.getSyncHistory(selectedServerId);
  }, [selectedServerId, refreshTrigger]);

  const handleTriggerSync = (type: 'FULL' | 'INCREMENTAL' | 'RECONCILIATION') => {
    setIsSyncing(true);
    setTimeout(() => {
      const record = mediaAccountEngine.triggerServerSync(selectedServerId, type);
      setIsSyncing(false);
      setSyncNotice(`اكتملت مزامنة (${type}) بنجاح! تم فحص ${record.users_checked} حساب.`);
      setRefreshTrigger(p => p + 1);
      setTimeout(() => setSyncNotice(null), 4000);
    }, 1200);
  };

  const handleSaveConfig = () => {
    if (!configModal.config) return;
    mediaAccountEngine.updateServerConfig(configModal.config.id, configModal.config);
    setConfigModal({ isOpen: false });
    setRefreshTrigger(p => p + 1);
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* Top Banner with Server Selector */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Health & Provisioning Monitor
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                metrics.health_status === 'HEALTHY'
                  ? 'bg-emerald-100 text-emerald-800'
                  : metrics.health_status === 'DEGRADED'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              حالة النظام: {metrics.health_status}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            لوحة مؤشرات التزويد وتزامن الحسابات
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة فورية لمعدلات نجاح التزويد والتطابق مع خوادم Jellyfin و Emby.
          </p>
        </div>

        {/* Server Switcher & Config Button */}
        <div className="flex items-center gap-2.5">
          <select
            value={selectedServerId}
            onChange={e => setSelectedServerId(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            onClick={() => setConfigModal({ isOpen: true, config: { ...currentServer } })}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            إعدادات التزويد
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Success Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">معدل نجاح التزويد</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-600">{metrics.success_rate}%</span>
            <span className="text-xs text-emerald-600 font-medium">إجمالي {metrics.total_mappings} حساب</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all"
              style={{ width: `${metrics.success_rate}%` }}
            />
          </div>
        </div>

        {/* In-Sync Accounts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">حسابات متطابقة (In Sync)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{metrics.in_sync}</span>
            <span className="text-xs text-slate-400">حساب نشط</span>
          </div>
          <p className="text-[11px] text-slate-500">تم التحقق من تطابق السياسات والبيانات</p>
        </div>

        {/* Out-of-Sync Accounts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">غير متطابقة / فشل</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">
              {metrics.out_of_sync + metrics.failed}
            </span>
            <span className="text-xs text-red-500 font-medium">
              {metrics.failed} فشل تزويد
            </span>
          </div>
          <p className="text-[11px] text-slate-500">يتطلب فحص الاتصال أو إعادة التزويد</p>
        </div>

        {/* Active Orphans */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-xs text-slate-500 font-medium">حسابات يتيمة مكتشفة</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{metrics.active_orphans}</span>
            <span className="text-xs text-amber-600 font-medium">بحاجة لقرار المشرف</span>
          </div>
          <p className="text-[11px] text-slate-500">موجودة في السيرفر دون ربط</p>
        </div>
      </div>

      {/* Manual Sync Controls Card */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-850 to-indigo-950 text-white p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            بدء مزامنة يدوية فورية مع {currentServer.name}
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            آخر مزامنة تمت في: {metrics.last_sync_at ? new Date(metrics.last_sync_at).toLocaleString('ar-EG') : 'لم تتم بعد'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTriggerSync('INCREMENTAL')}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            مزامنة سريعة (Incremental)
          </button>
          <button
            onClick={() => handleTriggerSync('FULL')}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            مزامنة كاملة (Full Sync)
          </button>
        </div>
      </div>

      {/* Sync History Audit Trail */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            سجل عمليات المزامنة الأخيرة (Sync Audit History)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="p-3">نوع العملية</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">وقت البدء</th>
                <th className="p-3">المفحوص</th>
                <th className="p-3">المحدث</th>
                <th className="p-3">الأيتام</th>
                <th className="p-3">المشغل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {syncHistory.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-semibold text-slate-800">{item.sync_type}</td>
                  <td className="p-3">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 font-mono">
                    {new Date(item.started_at).toLocaleTimeString('ar-EG')}
                  </td>
                  <td className="p-3 text-slate-700 font-medium">{item.users_checked}</td>
                  <td className="p-3 text-emerald-600 font-bold">{item.users_updated}</td>
                  <td className="p-3 text-amber-600 font-bold">{item.orphans_found}</td>
                  <td className="p-3 text-slate-500">{item.triggered_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Modal */}
      {configModal.isOpen && configModal.config && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 text-right space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-slate-900 text-base">إعدادات التزويد الآلي للخادم</h3>
            <p className="text-xs text-slate-500">{configModal.config.name}</p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">نمط اسم المستخدم (Username Pattern):</label>
                <input
                  type="text"
                  value={configModal.config.username_pattern}
                  onChange={e =>
                    setConfigModal(p => ({
                      ...p,
                      config: { ...p.config!, username_pattern: e.target.value }
                    }))
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  placeholder="LU-{lounge_id}"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  المتغيرات المتاحة: {'{lounge_id}'}, {'{username}'}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configModal.config.auto_create_on_first_login}
                    onChange={e =>
                      setConfigModal(p => ({
                        ...p,
                        config: { ...p.config!, auto_create_on_first_login: e.target.checked }
                      }))
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800">
                    إنشاء الحساب تلقائياً عند أول تسجيل دخول (Auto-create on first login)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configModal.config.auto_disable_on_subscription_expire}
                    onChange={e =>
                      setConfigModal(p => ({
                        ...p,
                        config: { ...p.config!, auto_disable_on_subscription_expire: e.target.checked }
                      }))
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800">
                    تعطيل حساب السيرفر فور انتهاء الاشتراك (Auto-disable on expire)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configModal.config.username_include_tenant}
                    onChange={e =>
                      setConfigModal(p => ({
                        ...p,
                        config: { ...p.config!, username_include_tenant: e.target.checked }
                      }))
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800">
                    تضمين معرف المستأجر في اسم المستخدم (Multi-tenant isolate)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setConfigModal({ isOpen: false })}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
              >
                حفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
