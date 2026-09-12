import React, { useState } from 'react';
import {
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Shield,
  RefreshCw,
  Eye,
  Tv,
  Film
} from 'lucide-react';
import { mediaAccountEngine } from '../../services/mediaAccountEngine';
import { MediaAccountMapping } from '../../types';

interface Props {
  currentUserId?: string;
  currentUsername?: string;
  currentLoungeId?: string;
}

export const UserMediaAccountsView: React.FC<Props> = ({
  currentUserId = 'u-1',
  currentUsername = 'ahmed_vip',
  currentLoungeId = 'LU-00101'
}) => {
  const [mappings, setMappings] = useState<MediaAccountMapping[]>(() =>
    mediaAccountEngine.getUserMappings(currentUserId)
  );

  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    mappingId: string;
    serverName: string;
    username: string;
    newPassword?: string;
    loading: boolean;
    copied: boolean;
  }>({
    isOpen: false,
    mappingId: '',
    serverName: '',
    username: '',
    loading: false,
    copied: false
  });

  const handleOpenResetModal = (mapping: MediaAccountMapping) => {
    setPasswordModal({
      isOpen: true,
      mappingId: mapping.id,
      serverName: mapping.media_server_name,
      username: mapping.external_username,
      newPassword: undefined,
      loading: false,
      copied: false
    });
  };

  const handleExecuteReset = () => {
    setPasswordModal(prev => ({ ...prev, loading: true }));
    setTimeout(() => {
      try {
        const res = mediaAccountEngine.resetPassword(passwordModal.mappingId);
        setPasswordModal(prev => ({
          ...prev,
          loading: false,
          newPassword: res.newPassword
        }));
        setMappings(mediaAccountEngine.getUserMappings(currentUserId));
      } catch (err) {
        console.error(err);
        setPasswordModal(prev => ({ ...prev, loading: false }));
      }
    }, 600);
  };

  const handleCopyPassword = () => {
    if (passwordModal.newPassword) {
      navigator.clipboard.writeText(passwordModal.newPassword);
      setPasswordModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => {
        setPasswordModal(prev => ({ ...prev, copied: false }));
      }, 2000);
    }
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Phase 10 • تكامل خوادم الوسائط
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full">
                Decision 11 & 18
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">حساباتك على خوادم الوسائط المحلية</h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              يتم إنشاء وإدارة حسابات البث المحلي على Jellyfin و Emby تلقائياً وربطها بهوية استراحتك ({currentLoungeId}).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-right">
              <span className="text-xs text-slate-400 block">المعرّف المحلي</span>
              <span className="font-mono text-emerald-400 font-bold">{currentLoungeId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {mappings.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl p-8 text-center border border-slate-200">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">لا توجد حسابات وسائط مربوطة حالياً</h3>
            <p className="text-slate-500 text-sm mt-1">
              سيتم تزويد حسابك تلقائياً عند أول تشغيل أو بواسطة مشرف الاستراحة.
            </p>
          </div>
        ) : (
          mappings.map(m => {
            const isJellyfin = m.server_type === 'jellyfin';
            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Top bar with server icon and status badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                          isJellyfin
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isJellyfin ? <Tv className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{m.media_server_name}</h3>
                        <span className="text-xs text-slate-500 font-mono">{m.server_type.toUpperCase()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          حساب نشط
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          معطل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Account Information box */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2 text-sm mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">اسم المستخدم على السيرفر:</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {m.external_username}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">عنوان السيرفر المحلي:</span>
                      <a
                        href={m.media_server_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-mono flex items-center gap-1 dir-ltr"
                      >
                        <span>{m.media_server_url}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">حالة التزامن:</span>
                      <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            m.sync_status === 'IN_SYNC' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        {m.sync_status === 'IN_SYNC' ? 'متطابق بالكامل' : 'غير متطابق'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    آخر فحص: {new Date(m.last_sync_at || m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => handleOpenResetModal(m)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                    تحديث كلمة المرور
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Password Reset Modal */}
      {passwordModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">تحديث كلمة مرور السيرفر</h3>
                  <p className="text-xs text-slate-500">{passwordModal.serverName}</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {!passwordModal.newPassword ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-3.5 rounded-xl space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    تنبيه أمان (Decision 57)
                  </p>
                  <p>
                    سيتم توليد كلمة مرور جديدة مشفرة بـ Fernet وتطبيقها فوراً على السيرفر ({passwordModal.username}).
                    ستظهر لك كلمة المرور لمرة واحدة فقط لنسخها واستخدامها في تطبيقات Jellyfin/Emby.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleExecuteReset}
                    disabled={passwordModal.loading}
                    className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    {passwordModal.loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التحديث...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        توليد وتعيين كلمة المرور
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>تم تعيين كلمة المرور الجديدة وتشفيرها بنجاح!</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">كلمة المرور الجديدة (انسخها الآن):</label>
                  <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-sm border border-slate-800">
                    <span className="flex-1 select-all tracking-wider">{passwordModal.newPassword}</span>
                    <button
                      onClick={handleCopyPassword}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                      title="نسخ"
                    >
                      {passwordModal.copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-xl"
                  >
                    تم الحفظ، إغلاق النافذة
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
