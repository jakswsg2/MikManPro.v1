import React, { useState } from 'react';
import {
  KeyRound,
  Fingerprint,
  Smartphone,
  Laptop,
  Tv,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Trash2,
  Plus,
  RefreshCw,
  CreditCard,
  Wifi,
  ExternalLink,
  Layers,
  AlertCircle
} from 'lucide-react';
import { LoungeSession, ExternalIdentity, LoungeUser } from '../types';
import {
  INITIAL_LOUNGE_SESSIONS,
  INITIAL_EXTERNAL_IDENTITIES
} from '../data/phase2Data';

interface SessionsAndIdentitiesManagerProps {
  currentUser: LoungeUser;
  allUsers: LoungeUser[];
}

export const SessionsAndIdentitiesManager: React.FC<SessionsAndIdentitiesManagerProps> = ({
  currentUser,
  allUsers,
}) => {
  const [sessions, setSessions] = useState<LoungeSession[]>(INITIAL_LOUNGE_SESSIONS);
  const [identities, setIdentities] = useState<ExternalIdentity[]>(INITIAL_EXTERNAL_IDENTITIES);

  // Link card modal state
  const [isLinkingCard, setIsLinkingCard] = useState(false);
  const [newCardNumber, setNewCardNumber] = useState('');
  const [selectedIdentityType, setSelectedIdentityType] = useState<'RADIUS' | 'MIKROTIK'>('RADIUS');
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null);

  // Revoke single session
  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'REVOKED',
              is_valid: false,
              revoked_at: new Date().toISOString(),
              revoked_reason: 'تم الإلغاء يدوياً بواسطة المستخدم (User logout)',
            }
          : s
      )
    );
  };

  // Revoke all sessions for current user
  const handleRevokeAllSessions = () => {
    setSessions((prev) =>
      prev.map((s) =>
        s.user_id === currentUser.id
          ? {
              ...s,
              status: 'REVOKED',
              is_valid: false,
              revoked_at: new Date().toISOString(),
              revoked_reason: 'تسجيل خروج جماعي من كافة الأجهزة',
            }
          : s
      )
    );
  };

  // Link additional card (Decision 25)
  const handleLinkCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNumber.trim()) return;

    const newExtIdentity: ExternalIdentity = {
      id: `ext-id-${Date.now()}`,
      user_id: currentUser.id,
      user_lounge_id: currentUser.lounge_id,
      user_full_name: currentUser.full_name,
      identity_type: selectedIdentityType,
      external_id: newCardNumber.trim().toUpperCase(),
      is_primary: false,
      is_verified: true,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      external_metadata: {
        linked_at: new Date().toISOString(),
        method: 'User Dashboard (Decision 25)',
      },
    };

    setIdentities((prev) => [newExtIdentity, ...prev]);
    setLinkSuccessMessage(`تم ربط الكارت [${newCardNumber.toUpperCase()}] بنجاح بحسابك (${currentUser.lounge_id})`);
    setNewCardNumber('');
    setIsLinkingCard(false);

    setTimeout(() => {
      setLinkSuccessMessage(null);
    }, 4000);
  };

  const activeSessionsCount = sessions.filter((s) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-3">
              <KeyRound className="w-3.5 h-3.5" />
              <span>المرحلة 2: إدارة الجلسات وتدوير التوكنات (Session Management)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              الجلسات النشطة والهويات الخارجية (External Identities)
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              وفقاً للقرار 10 والقرار 25: يتم تتبع كل جهاز متصل عبر تجزئة SHA-256 المشفرة دون تخزين التوكن الأصلي،
              مع دعم تدوير التوكنات الإجباري وإمكانية ربط أكثر من كارت أو جهاز بحساب الاستراحة الواحد.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setIsLinkingCard(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>ربط كارت إضافي (Decision 25)</span>
            </button>
            <button
              onClick={handleRevokeAllSessions}
              className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 font-bold text-xs flex items-center gap-2 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>تسجيل خروج من كل الأجهزة</span>
            </button>
          </div>
        </div>
      </div>

      {linkSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{linkSuccessMessage}</span>
        </div>
      )}

      {/* SECTION 1: Active Lounge Sessions Table (Decision 10) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-amber-400" />
              <span>جلسات الاستراحة النشطة (Active Lounge Sessions)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تخزين التجزئة الآمنة (SHA-256 Token Hash) لمنع استغلال التوكنات عند اختراق قواعد البيانات (Decision 10).
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {activeSessionsCount} جلسة نشطة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-semibold">المستخدم و Lounge ID</th>
                <th className="p-4 font-semibold">تجزئة الجلسة (SHA-256)</th>
                <th className="p-4 font-semibold">عنوان IP والجهاز</th>
                <th className="p-4 font-semibold">مصدر الدخول</th>
                <th className="p-4 font-semibold">الحالة</th>
                <th className="p-4 font-semibold">وقت الإصدار والانتهاء</th>
                <th className="p-4 font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {sessions.map((sess) => {
                const isActive = sess.status === 'ACTIVE';

                return (
                  <tr key={sess.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <div className="font-bold text-slate-100">{sess.user_full_name}</div>
                      <div className="font-mono text-amber-400 text-[11px]">{sess.user_lounge_id}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-emerald-400 text-[11px] max-w-xs truncate" title={sess.session_token_hash}>
                        {sess.session_token_hash.substring(0, 20)}...
                      </div>
                      <div className="text-[10px] text-slate-500">SHA-256 Secure Hash</div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-slate-200">{sess.ip_address}</div>
                      <div className="text-[11px] text-slate-400 max-w-xs truncate" title={sess.user_agent}>
                        {sess.user_agent}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                        {sess.source}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                          isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                            : 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                        }`}
                      >
                        {isActive ? 'نشطة (Active)' : 'ملغاة (Revoked)'}
                      </span>
                      {!isActive && sess.revoked_reason && (
                        <div className="text-[10px] text-slate-400 mt-1 max-w-xs truncate">
                          {sess.revoked_reason}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-400">
                      <div>إصدار: {new Date(sess.issued_at).toLocaleTimeString('ar-EG')}</div>
                      <div>انتهاء: {new Date(sess.expires_at).toLocaleTimeString('ar-EG')}</div>
                    </td>
                    <td className="p-4 text-center">
                      {isActive ? (
                        <button
                          onClick={() => handleRevokeSession(sess.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 mx-auto transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>إلغاء فورياً</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">تم الإلغاء</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Linked External Identities (Decision 25) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>الهويات والكروت المرتبطة بحسابات الاستراحة (External Identities & Cards)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Decision 25: يسمح بربط عدة كروت أو عناوين MAC بنفس الـ Lounge User ID لدمج الأجهزة أو العائلات.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {identities.length} كروت وهويات
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-semibold">حساب الاستراحة (Lounge User)</th>
                <th className="p-4 font-semibold">نوع الهوية الخارجية</th>
                <th className="p-4 font-semibold">المعرّف الخارجي (Card / MAC)</th>
                <th className="p-4 font-semibold">الأساسي (Primary)</th>
                <th className="p-4 font-semibold">البيانات الوصفية (Metadata)</th>
                <th className="p-4 font-semibold">تاريخ أول ظهور</th>
                <th className="p-4 font-semibold">آخر نشاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {identities.map((ident) => (
                <tr key={ident.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4">
                    <div className="font-bold text-slate-100">{ident.user_full_name}</div>
                    <div className="font-mono text-amber-400 text-[11px]">{ident.user_lounge_id}</div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                      {ident.identity_type}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-100">
                    {ident.external_id}
                  </td>
                  <td className="p-4">
                    {ident.is_primary ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold">
                        الهوية الأساسية
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        كارت إضافي
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-[11px] text-slate-400">
                    {ident.external_metadata ? JSON.stringify(ident.external_metadata) : '—'}
                  </td>
                  <td className="p-4 font-mono text-slate-400">
                    {new Date(ident.first_seen_at).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="p-4 font-mono text-emerald-400">
                    {new Date(ident.last_seen_at).toLocaleTimeString('ar-EG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Link Card Form (Decision 25) */}
      {isLinkingCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                <span>ربط كارت إضافي بحسابك (Decision 25)</span>
              </h3>
              <button
                onClick={() => setIsLinkingCard(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              أدخل رقم كارت هوتسبوت إضافي أو عنوان MAC لجهاز آخر لربطه بنفس حساب الاستراحة (
              <strong className="text-amber-400 font-mono">{currentUser.lounge_id}</strong>) للوصول لنفس المحتوى والصلاحيات.
            </p>

            <form onSubmit={handleLinkCardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  نوع الهوية المراد ربطها:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedIdentityType('RADIUS')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedIdentityType === 'RADIUS'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    كارت / قسيمة RADIUS
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIdentityType('MIKROTIK')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      selectedIdentityType === 'MIKROTIK'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    عنوان MAC لراوتر MikroTik
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {selectedIdentityType === 'RADIUS' ? 'رقم الكارت (Voucher Code):' : 'عنوان الماك (MAC Address):'}
                </label>
                <input
                  type="text"
                  required
                  value={newCardNumber}
                  onChange={(e) => setNewCardNumber(e.target.value.toUpperCase())}
                  placeholder={selectedIdentityType === 'RADIUS' ? 'مثال: CARD-88219' : 'مثال: 00:1A:79:4C:E5:88'}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkingCard(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow"
                >
                  تأكيد وربط الكارت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
