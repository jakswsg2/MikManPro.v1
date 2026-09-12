import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Trash2,
  PowerOff,
  Check,
  Copy,
  Plus,
  Tv,
  Film,
  Server
} from 'lucide-react';
import { mediaAccountEngine } from '../../services/mediaAccountEngine';
import { MediaAccountMapping, ProvisioningStatus } from '../../types';

export const AdminMediaAccountsGrid: React.FC = () => {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [passwordRevealModal, setPasswordRevealModal] = useState<{
    isOpen: boolean;
    username: string;
    newPassword?: string;
    copied: boolean;
  }>({
    isOpen: false,
    username: '',
    copied: false
  });

  const [provisionModal, setProvisionModal] = useState<{
    isOpen: boolean;
    userId: string;
    username: string;
    loungeId: string;
    serverId: string;
  }>({
    isOpen: false,
    userId: 'u-5',
    username: 'zayd_stream',
    loungeId: 'LU-00105',
    serverId: 'srv-lan-jellyfin-01'
  });

  const servers = useMemo(() => mediaAccountEngine.getServers(), [refreshTrigger]);

  const mappings = useMemo(() => {
    return mediaAccountEngine.getMappings({
      media_server_id: selectedServer || undefined,
      status: selectedStatus || undefined,
      search: searchQuery || undefined
    }).filter(m => m.provisioning_status !== 'DELETED');
  }, [selectedServer, selectedStatus, searchQuery, refreshTrigger]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(mappings.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDisable = (id: string) => {
    mediaAccountEngine.disableMapping(id, 'Admin manual suspension');
    setRefreshTrigger(p => p + 1);
  };

  const handleEnable = (id: string) => {
    mediaAccountEngine.enableMapping(id);
    setRefreshTrigger(p => p + 1);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف الحساب من السيرفر وإلغاء الربط؟')) {
      mediaAccountEngine.deleteMapping(id, 'Admin deletion');
      setRefreshTrigger(p => p + 1);
    }
  };

  const handleSync = (id: string) => {
    mediaAccountEngine.syncMapping(id);
    setRefreshTrigger(p => p + 1);
  };

  const handleResetPassword = (id: string) => {
    try {
      const res = mediaAccountEngine.resetPassword(id);
      setPasswordRevealModal({
        isOpen: true,
        username: res.username,
        newPassword: res.newPassword,
        copied: false
      });
      setRefreshTrigger(p => p + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDisable = () => {
    if (selectedIds.length === 0) return;
    mediaAccountEngine.bulkDisable(selectedIds);
    setSelectedIds([]);
    setRefreshTrigger(p => p + 1);
  };

  const handleBulkApplyPolicy = () => {
    if (selectedIds.length === 0) return;
    mediaAccountEngine.bulkApplyPolicy(selectedIds);
    alert(`تم إعادة تطبيق سياسات الصلاحيات على ${selectedIds.length} حساب بنجاح.`);
    setSelectedIds([]);
    setRefreshTrigger(p => p + 1);
  };

  const handleExecuteProvision = () => {
    mediaAccountEngine.provisionUser(
      {
        id: provisionModal.userId,
        username: provisionModal.username,
        lounge_id: provisionModal.loungeId
      },
      provisionModal.serverId
    );
    setProvisionModal(prev => ({ ...prev, isOpen: false }));
    setRefreshTrigger(p => p + 1);
  };

  return (
    <div className="space-y-5 text-slate-800" dir="rtl">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            إدارة حسابات Media Server Mappings
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة وإدارة الربط الفعلي بين هويات الاستراحة وحسابات Jellyfin / Emby (Decision 11 & 18).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProvisionModal(prev => ({ ...prev, isOpen: true }))}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            تزويد حساب جديد
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث بالاسم، LoungeID، أو اسم السيرفر..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Server filter */}
          <select
            value={selectedServer}
            onChange={e => setSelectedServer(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">جميع السيرفرات</option>
            {servers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">جميع الحالات</option>
            <option value="COMPLETED">مكتمل (Active)</option>
            <option value="PENDING">في الانتظار (Pending)</option>
            <option value="FAILED">فشل (Failed)</option>
            <option value="DISABLED">معطل (Disabled)</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-indigo-900 font-medium">{selectedIds.length} محدد</span>
            <button
              onClick={handleBulkDisable}
              className="text-xs bg-white text-slate-700 hover:text-red-600 border border-slate-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
            >
              تعطيل الحسابات
            </button>
            <button
              onClick={handleBulkApplyPolicy}
              className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded-lg font-medium transition-colors"
            >
              تطبيق السياسات
            </button>
          </div>
        )}
      </div>

      {/* Mappings Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === mappings.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="p-3.5">مستخدم الاستراحة</th>
                <th className="p-3.5">خادم الوسائط</th>
                <th className="p-3.5">حساب السيرفر (External)</th>
                <th className="p-3.5">النمط</th>
                <th className="p-3.5">حالة التزويد</th>
                <th className="p-3.5">التزامن</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد حسابات مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                mappings.map(m => {
                  const isJellyfin = m.server_type === 'jellyfin';
                  const isSelected = selectedIds.includes(m.id);

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(m.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* User Column */}
                      <td className="p-3.5 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            {m.user_username[0].toUpperCase()}
                          </span>
                          <div>
                            <div className="font-semibold">{m.user_username}</div>
                            <span className="font-mono text-[11px] text-emerald-600 font-bold">
                              {m.user_lounge_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Server Column */}
                      <td className="p-3.5 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          {isJellyfin ? (
                            <span className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                              JF
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                              EB
                            </span>
                          )}
                          <span className="font-medium">{m.media_server_name}</span>
                        </div>
                      </td>

                      {/* External Username Column */}
                      <td className="p-3.5 font-mono font-medium text-slate-800">
                        {m.external_username || <span className="text-slate-400 italic">غير منشأ</span>}
                      </td>

                      {/* Mode */}
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded font-medium">
                          {m.provisioning_mode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        {m.provisioning_status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            مكتمل
                          </span>
                        )}
                        {m.provisioning_status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            بالانتظار
                          </span>
                        )}
                        {m.provisioning_status === 'FAILED' && (
                          <span
                            title={m.provisioning_error || 'خطأ في التزويد'}
                            className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-red-200 cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            فشل ({m.provisioning_attempts})
                          </span>
                        )}
                        {m.provisioning_status === 'DISABLED' && (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            معطل
                          </span>
                        )}
                      </td>

                      {/* Sync Status */}
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 font-medium text-[11px] ${
                            m.sync_status === 'IN_SYNC' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.sync_status === 'IN_SYNC' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {m.sync_status === 'IN_SYNC' ? 'متطابق' : 'يحتاج فحص'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleResetPassword(m.id)}
                            title="توليد وتعيين كلمة مرور جديدة"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleSync(m.id)}
                            title="مزامنة الحالة مع السيرفر الآن"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {m.is_active ? (
                            <button
                              onClick={() => handleDisable(m.id)}
                              title="تعطيل الحساب مؤقتاً"
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnable(m.id)}
                              title="إعادة تفعيل الحساب"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(m.id)}
                            title="حذف الحساب"
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reveal Modal */}
      {passwordRevealModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right">
            <h3 className="font-bold text-slate-900 text-base mb-1">تم تدوير كلمة المرور بنجاح</h3>
            <p className="text-xs text-slate-500 mb-4">
              حساب المستخدم: <span className="font-mono font-bold text-slate-800">{passwordRevealModal.username}</span>
            </p>

            <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-sm flex items-center justify-between border border-slate-800 mb-4">
              <span className="select-all tracking-wider">{passwordRevealModal.newPassword}</span>
              <button
                onClick={() => {
                  if (passwordRevealModal.newPassword) {
                    navigator.clipboard.writeText(passwordRevealModal.newPassword);
                    setPasswordRevealModal(p => ({ ...p, copied: true }));
                    setTimeout(() => setPasswordRevealModal(p => ({ ...p, copied: false })), 2000);
                  }
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300"
              >
                {passwordRevealModal.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => setPasswordRevealModal(p => ({ ...p, isOpen: false }))}
              className="w-full py-2 bg-slate-900 text-white font-medium text-xs rounded-xl"
            >
              تم النسخ وإغلاق
            </button>
          </div>
        </div>
      )}

      {/* Provision New User Modal */}
      {provisionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right space-y-4">
            <h3 className="font-bold text-slate-900 text-base">تزويد حساب جديد على خادم الوسائط</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">المستخدم (Lounge User):</label>
                <input
                  type="text"
                  value={provisionModal.username}
                  onChange={e => setProvisionModal(p => ({ ...p, username: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">كود الاستراحة (Lounge ID):</label>
                <input
                  type="text"
                  value={provisionModal.loungeId}
                  onChange={e => setProvisionModal(p => ({ ...p, loungeId: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">خادم الوسائط المستهدف:</label>
                <select
                  value={provisionModal.serverId}
                  onChange={e => setProvisionModal(p => ({ ...p, serverId: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {servers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setProvisionModal(p => ({ ...p, isOpen: false }))}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteProvision}
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
              >
                تأكيد التزويد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
