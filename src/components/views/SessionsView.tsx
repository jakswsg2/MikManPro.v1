import React, { useState } from 'react';
import { LoungeUser, LoungeSession } from '../../types';
import { Translations } from '../../lib/i18n';
import { SmartLoungeApiClient } from '../../lib/apiClient';
import { 
  Smartphone, Monitor, Tablet, Laptop, ShieldAlert, 
  Trash2, LogOut, CheckCircle2, Clock, MapPin, AlertCircle 
} from 'lucide-react';

interface SessionsViewProps {
  currentUser: LoungeUser;
  t: Translations;
}

const MOCK_INITIAL_SESSIONS: LoungeSession[] = [
  {
    id: 'sess-current-01',
    user_id: 'user-1',
    user_lounge_id: 'LU-000152',
    user_full_name: 'أحمد السعيد',
    session_token_hash: 'hash_curr_91823',
    ip_address: '10.0.10.45',
    user_agent: 'Chrome 128 / macOS 14.6',
    device_fingerprint: 'fp-mac-9921',
    source: 'HOTSPOT',
    status: 'ACTIVE',
    is_valid: true,
    issued_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    last_activity_at: new Date().toISOString()
  },
  {
    id: 'sess-mobile-02',
    user_id: 'user-1',
    user_lounge_id: 'LU-000152',
    user_full_name: 'أحمد السعيد',
    session_token_hash: 'hash_mob_11827',
    ip_address: '10.0.10.88',
    user_agent: 'Safari / iPhone 15 Pro (iOS 17.5)',
    device_fingerprint: 'fp-ios-8812',
    source: 'HOTSPOT',
    status: 'ACTIVE',
    is_valid: true,
    issued_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 9 * 3600 * 1000).toISOString(),
    last_activity_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'sess-tv-03',
    user_id: 'user-1',
    user_lounge_id: 'LU-000152',
    user_full_name: 'أحمد السعيد',
    session_token_hash: 'hash_tv_55412',
    ip_address: '10.0.10.120',
    user_agent: 'Smart TV / Android TV 12',
    device_fingerprint: 'fp-tv-5541',
    source: 'RADIUS',
    status: 'ACTIVE',
    is_valid: true,
    issued_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    last_activity_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  }
];

export const SessionsView: React.FC<SessionsViewProps> = ({
  currentUser,
  t
}) => {
  const [sessions, setSessions] = useState<LoungeSession[]>(MOCK_INITIAL_SESSIONS);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('tv')) return <Monitor className="w-5 h-5 text-purple-400" />;
    if (ua.includes('iphone') || ua.includes('android')) return <Smartphone className="w-5 h-5 text-blue-400" />;
    if (ua.includes('ipad') || ua.includes('tablet')) return <Tablet className="w-5 h-5 text-emerald-400" />;
    return <Laptop className="w-5 h-5 text-amber-400" />;
  };

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    await SmartLoungeApiClient.revokeSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setRevokingId(null);
    setNoticeMessage(t.revokeSuccess);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleRevokeOthers = async () => {
    setRevokingId('others');
    const otherSessions = sessions.filter((s) => s.id !== sessions[0].id);
    for (const sess of otherSessions) {
      await SmartLoungeApiClient.revokeSession(sess.id);
    }
    setSessions([sessions[0]]);
    setRevokingId(null);
    setNoticeMessage(t.revokeSuccess);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-right">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{t.activeSessions}</h2>
            <p className="text-xs text-slate-400">
              الأجهزة المتصلة بحسابك حالياً عبر شبكة الاستراحة المحلية (باقة: {currentUser.active_profile.name} - حد الأجهزة: {currentUser.active_profile.max_devices})
            </p>
          </div>
        </div>

        {sessions.length > 1 && (
          <button
            onClick={handleRevokeOthers}
            disabled={revokingId === 'others'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold text-xs border border-red-500/30 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>{t.revokeOtherSessions}</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {noticeMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-3">
        {sessions.map((sess, idx) => {
          const isCurrent = idx === 0;
          return (
            <div
              key={sess.id}
              className={`p-5 rounded-3xl border transition-all ${
                isCurrent
                  ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                    {getDeviceIcon(sess.user_agent)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{sess.user_agent}</h4>
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold text-[10px] font-mono">
                          {t.currentDevice}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>IP: <strong className="text-slate-200">{sess.ip_address}</strong></span>
                      <span>•</span>
                      <span>بوابة: <strong className="text-slate-200">{sess.source}</strong></span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {t.active}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Revoke Action */}
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(sess.id)}
                    disabled={revokingId === sess.id}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-red-500/20 text-slate-400 hover:text-red-400 font-semibold text-xs border border-slate-800 hover:border-red-500/40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.revokeSession}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
