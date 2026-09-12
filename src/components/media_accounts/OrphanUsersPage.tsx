import React, { useState, useMemo } from 'react';
import {
  UserX,
  Link,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Filter,
  Search,
  Check
} from 'lucide-react';
import { mediaAccountEngine } from '../../services/mediaAccountEngine';
import { MediaServerOrphanUser } from '../../types';

export const OrphanUsersPage: React.FC = () => {
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [claimModal, setClaimModal] = useState<{
    isOpen: boolean;
    orphan?: MediaServerOrphanUser;
    userId: string;
    username: string;
    loungeId: string;
  }>({
    isOpen: false,
    userId: 'u-10',
    username: 'omar_gamer',
    loungeId: 'LU-00110'
  });

  const servers = useMemo(() => mediaAccountEngine.getServers(), [refreshTrigger]);

  const orphans = useMemo(() => {
    return mediaAccountEngine.getOrphans(
      selectedServer || undefined,
      selectedStatus || undefined
    );
  }, [selectedServer, selectedStatus, refreshTrigger]);

  const handleOpenClaim = (orphan: MediaServerOrphanUser) => {
    setClaimModal({
      isOpen: true,
      orphan,
      userId: 'u-10',
      username: 'omar_gamer',
      loungeId: 'LU-00110'
    });
  };

  const handleExecuteClaim = () => {
    if (!claimModal.orphan) return;
    try {
      mediaAccountEngine.claimOrphan(claimModal.orphan.id, {
        id: claimModal.userId,
        username: claimModal.username,
        lounge_id: claimModal.loungeId
      });
      setClaimModal(prev => ({ ...prev, isOpen: false }));
      setRefreshTrigger(p => p + 1);
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnore = (id: string) => {
    const note = window.prompt('سبب تجاهل هذا الحساب (مثال: حساب صيانة داخلي):', 'حساب إداري داخلي');
    if (note !== null) {
      mediaAccountEngine.ignoreOrphan(id, note);
      setRefreshTrigger(p => p + 1);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحساب غير المربوط نهائياً من خادم الوسائط؟')) {
      mediaAccountEngine.deleteOrphan(id);
      setRefreshTrigger(p => p + 1);
    }
  };

  return (
    <div className="space-y-5 text-slate-800" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Orphan Accounts Management
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserX className="w-5 h-5 text-amber-600" />
            إدارة الحسابات المنفصلة (الأيتام على السيرفر)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            حسابات تم العثور عليها داخل Jellyfin / Emby دون وجود سجل ربط لها في Smart Lounge.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <select
          value={selectedServer}
          onChange={e => setSelectedServer(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
        >
          <option value="">جميع السيرفرات</option>
          {servers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700"
        >
          <option value="">جميع الحالات</option>
          <option value="NEW">جديد (غير محسوم)</option>
          <option value="CLAIMED">تم ربطه (Claimed)</option>
          <option value="IGNORED">متجاهل (Ignored)</option>
          <option value="DELETED">محذوف (Deleted)</option>
        </select>
      </div>

      {/* Orphans Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3.5">اسم الحساب على السيرفر</th>
                <th className="p-3.5">خادم الوسائط</th>
                <th className="p-3.5">المعرف الخارجي</th>
                <th className="p-3.5">تاريخ الاكتشاف</th>
                <th className="p-3.5">الحالة</th>
                <th className="p-3.5">ملاحظات / القرار</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orphans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد حسابات أيتام مسجلة. النظام متطابق بنسبة 100%!
                  </td>
                </tr>
              ) : (
                orphans.map(o => {
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-slate-900">
                        {o.external_username}
                      </td>

                      <td className="p-3.5 text-slate-700 font-medium">
                        {o.media_server_name}
                      </td>

                      <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                        {o.external_user_id}
                      </td>

                      <td className="p-3.5 text-slate-500">
                        {new Date(o.detected_at).toLocaleDateString('ar-EG')}
                      </td>

                      <td className="p-3.5">
                        {o.status === 'NEW' && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                            جديد
                          </span>
                        )}
                        {o.status === 'CLAIMED' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                            تم الربط
                          </span>
                        )}
                        {o.status === 'IGNORED' && (
                          <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                            متجاهل
                          </span>
                        )}
                        {o.status === 'DELETED' && (
                          <span className="bg-red-100 text-red-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                            محذوف
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-600 text-[11px]">
                        {o.resolution_note || o.claimed_by_username || '—'}
                      </td>

                      <td className="p-3.5 text-center">
                        {o.status === 'NEW' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenClaim(o)}
                              title="ربط الحساب بمستخدم في الاستراحة"
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 font-medium transition-colors"
                            >
                              <Link className="w-3 h-3" />
                              ربط
                            </button>

                            <button
                              onClick={() => handleIgnore(o.id)}
                              title="تجاهل الحساب وعدم حذفه"
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDelete(o.id)}
                              title="حذف الحساب من السيرفر"
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">تم الإجراء</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Claim Modal */}
      {claimModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right space-y-4">
            <h3 className="font-bold text-slate-900 text-base">ربط حساب يتيم بمستخدم الاستراحة</h3>
            <p className="text-xs text-slate-500">
              سيتم إنشاء سجل mapping رسمي للحساب <span className="font-mono font-bold text-slate-800">{claimModal.orphan?.external_username}</span> على {claimModal.orphan?.media_server_name}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">اسم مستخدم الاستراحة:</label>
                <input
                  type="text"
                  value={claimModal.username}
                  onChange={e => setClaimModal(p => ({ ...p, username: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">معرف الاستراحة (Lounge ID):</label>
                <input
                  type="text"
                  value={claimModal.loungeId}
                  onChange={e => setClaimModal(p => ({ ...p, loungeId: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setClaimModal(p => ({ ...p, isOpen: false }))}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteClaim}
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
              >
                تأكيد الربط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
