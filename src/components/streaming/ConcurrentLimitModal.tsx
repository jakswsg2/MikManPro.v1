import React from 'react';
import { PlaybackSession, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ConcurrentSessionsService } from '../../services/playbackEngine';
import { ShieldAlert, Monitor, Tv, Smartphone, XCircle, ArrowRight } from 'lucide-react';

interface ConcurrentLimitModalProps {
  user: LoungeUser;
  oldestSession?: PlaybackSession;
  t: Translations;
  onEvictOldestAndPlay: () => void;
  onCancel: () => void;
}

export const ConcurrentLimitModal: React.FC<ConcurrentLimitModalProps> = ({
  user,
  oldestSession,
  t,
  onEvictOldestAndPlay,
  onCancel,
}) => {
  const maxAllowed = user.active_profile?.max_concurrent_sessions || 2;

  const handleEvict = () => {
    if (oldestSession) {
      ConcurrentSessionsService.terminateSession(oldestSession.id);
    }
    onEvictOldestAndPlay();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-red-500/30 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">تم الوصول للحد الأقصى للمشاهدة</h3>
            <p className="text-xs text-red-400">Concurrent Sessions Limit Exceeded ({maxAllowed} Devices)</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          حسابك في باقة <strong className="text-amber-400 font-bold">{user.active_profile?.name}</strong> يسمح بالتشغيل المتزامن على{' '}
          <strong className="text-white font-bold">{maxAllowed} أجهزة</strong> في نفس الوقت. هناك جلسة نشطة حالياً.
        </p>

        {oldestSession && (
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block">الجلسة النشطة الأقدم:</span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">{oldestSession.device_name || 'جهاز آخر'}</span>
              </div>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                {oldestSession.media_item_title}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
              <span>IP: {oldestSession.client_ip}</span>
              <span>بدأ: {new Date(oldestSession.started_at).toLocaleTimeString('ar-SA')}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleEvict}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
          >
            <span>إيقاف الجهاز القديم والمتابعة</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>

          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>إلغاء</span>
          </button>
        </div>
      </div>
    </div>
  );
};
