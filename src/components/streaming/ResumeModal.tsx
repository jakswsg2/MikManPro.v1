import React from 'react';
import { MediaItem, WatchHistory } from '../../types';
import { Translations } from '../../lib/i18n';
import { Play, RotateCcw, Clock, Film } from 'lucide-react';

interface ResumeModalProps {
  item: MediaItem;
  history: WatchHistory;
  t: Translations;
  onConfirmResume: () => void;
  onStartOver: () => void;
  onCancel: () => void;
}

export const ResumeModal: React.FC<ResumeModalProps> = ({
  item,
  history,
  t,
  onConfirmResume,
  onStartOver,
  onCancel,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formattedPos = formatTime(history.position_seconds);
  const totalMins = item.duration_minutes || Math.floor(history.duration_seconds / 60) || 120;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-5">
        {/* Header with thumbnail */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-24 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700/60 shadow">
            <img
              src={item.poster_url}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>متابعة المشاهدة • Resume</span>
            </div>
            <h3 className="text-white font-bold text-base leading-snug">{item.title}</h3>
            <p className="text-xs text-slate-400">
              توقفت سابقاً عند الدقيقة <span className="font-mono text-amber-300 font-bold">{formattedPos}</span> ({history.completion_percentage}% من العمل)
            </p>
          </div>
        </div>

        {/* Progress Visual Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>{formattedPos}</span>
            <span>{totalMins}:00</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
              style={{ width: `${history.completion_percentage}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onConfirmResume}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>متابعة من {formattedPos}</span>
          </button>

          <button
            onClick={onStartOver}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>البدء من البداية</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-colors pt-1 cursor-pointer"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
};
