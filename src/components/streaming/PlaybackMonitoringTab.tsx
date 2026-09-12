import React, { useState, useEffect } from 'react';
import { PlaybackSession, PlaybackToken, WatchHistory, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import {
  ConcurrentSessionsService,
  PlaybackTokenService,
  WatchHistoryService
} from '../../services/playbackEngine';
import {
  Play,
  Pause,
  Tv,
  Monitor,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Key,
  XCircle,
  Activity,
  Layers,
  Sparkles,
  Server,
  Trash2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface PlaybackMonitoringTabProps {
  currentUser: LoungeUser;
  t: Translations;
}

export const PlaybackMonitoringTab: React.FC<PlaybackMonitoringTabProps> = ({
  currentUser,
  t,
}) => {
  const [sessions, setSessions] = useState<PlaybackSession[]>([]);
  const [tokens, setTokens] = useState<PlaybackToken[]>([]);
  const [history, setHistory] = useState<WatchHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'sessions' | 'tokens' | 'history' | 'anti_sharing'>('sessions');

  const refreshData = () => {
    setSessions(ConcurrentSessionsService.getAllSessions());
    setTokens(PlaybackTokenService.getActiveTokens());
    setHistory(WatchHistoryService.getHistory());
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminateSession = (sessionId: string) => {
    ConcurrentSessionsService.terminateSession(sessionId);
    refreshData();
  };

  const handleRevokeToken = (tokenId: string) => {
    PlaybackTokenService.revokeToken(tokenId, 'Admin manually revoked token');
    refreshData();
  };

  const activeSessionsCount = sessions.filter(
    s => s.status === 'PLAYING' || s.status === 'PAUSED'
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn text-slate-200">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الجلسات النشطة</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {activeSessionsCount}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الرموز الموقعة (Tokens)</span>
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            {tokens.length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>سجلات المشاهدة (Resume)</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-400">
            {history.length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>طريقة البث الافتراضية</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xs font-bold font-mono text-purple-300">
            DirectPlay (Zero Transcode)
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex gap-2">
          {[
            { id: 'sessions', label: `جلسات التشغيل (${sessions.length})` },
            { id: 'tokens', label: `مفاتيح HMAC Tokens (${tokens.length})` },
            { id: 'history', label: `سجل الاستئناف Resume (${history.length})` },
            { id: 'anti_sharing', label: 'مكافحة المشاركة Anti-Sharing' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={refreshData}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Active Playback Sessions */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              لا توجد جلسات تشغيل مسجلة حالياً
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.status === 'PLAYING'
                            ? 'bg-emerald-500 animate-pulse'
                            : s.status === 'PAUSED'
                            ? 'bg-amber-500'
                            : 'bg-slate-600'
                        }`}
                      />
                      <strong className="text-white font-bold">{s.media_item_title}</strong>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {s.resolution}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {s.playback_method}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>المستخدم: {s.user_full_name} ({s.user_lounge_id})</span>
                      <span>•</span>
                      <span>الجهاز: {s.device_name || 'Browser'}</span>
                      <span>•</span>
                      <span>IP: {s.client_ip}</span>
                      <span>•</span>
                      <span>الموضع: {Math.floor(s.position_seconds / 60)}:00 / {Math.floor(s.duration_seconds / 60)}:00</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {s.status === 'PLAYING' && (
                      <button
                        onClick={() => handleTerminateSession(s.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>إنهاء الجلسة</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Playback Tokens (HMAC & TTL) */}
      {activeTab === 'tokens' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
            مفاتيح HMAC القصيرة (TTL 300s) تخزن في الذاكرة كـ SHA-256 Hash وتربط المستخدم والجهاز بالمحتوى بدون كشف المفاتيح الحقيقية.
          </div>

          <div className="space-y-2">
            {tokens.map((tok) => (
              <div
                key={tok.id}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 font-mono">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 font-bold">{tok.token_hash}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Scope: {tok.scope}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>IP: {tok.ip_address}</span>
                    <span>الاستخدامات: {tok.current_uses}/{tok.max_uses}</span>
                    <span>ينتهي: {new Date(tok.expires_at).toLocaleTimeString('ar-SA')}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRevokeToken(tok.id)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 text-xs cursor-pointer transition-colors"
                >
                  إبطال المفتاح
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Watch History / Resume */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.map((h) => (
            <div
              key={h.id}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <img
                  src={h.media_item.poster_url}
                  alt={h.media_item.title}
                  className="w-8 h-12 object-cover rounded bg-slate-800"
                />
                <div>
                  <h4 className="text-white font-bold">{h.media_item.title}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pt-0.5">
                    <span>الموضع: {Math.floor(h.position_seconds / 60)} دقيقة</span>
                    <span>•</span>
                    <span className="text-amber-400">{h.completion_percentage}% مكتمل</span>
                    {h.is_completed && <span className="text-emerald-400 font-bold">(تمت المشاهدة)</span>}
                  </div>
                </div>
              </div>

              <span className="text-[11px] text-slate-500 font-mono">
                آخر مشاهدة: {new Date(h.last_watched_at).toLocaleDateString('ar-SA')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Anti-Sharing Engine */}
      {activeTab === 'anti_sharing' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>معايير مكافحة مشاركة الحسابات (Anti-Sharing Protection)</span>
            </div>
            <ul className="space-y-2 text-slate-300 list-disc list-inside">
              <li>
                <strong>فحص الجلسات المتزامنة (Concurrent Sessions Limit):</strong> باقة {currentUser.active_profile.name} محددة بـ {currentUser.active_profile.max_concurrent_sessions} أجهزة في نفس الوقت.
              </li>
              <li>
                <strong>بصمة الجهاز (Device Fingerprint):</strong> يتم حظر ومراقبة أي تغيير غير مألوف في الـ User-Agent أو عنوان الـ MAC خلال الجلسة النشطة.
              </li>
              <li>
                <strong>تغيير عنوان الـ IP الفوري:</strong> يتم التحقق من عدم بث نفس الرابط الموقّع من نطاقين مختلفين داخل شبكة الـ LAN.
              </li>
              <li>
                <strong>حظر التحميل المتوازي غير المصرح:</strong> إبطال تلقائي للـ Token إذا زاد عدد الطلبات عن 5 استخدامات متزامنة بدون تجديد.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
