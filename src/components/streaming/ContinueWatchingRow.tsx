import React from 'react';
import { WatchHistory, LoungeUser, MediaItem } from '../../types';
import { Translations } from '../../lib/i18n';
import { Play, Clock, Sparkles } from 'lucide-react';

interface ContinueWatchingRowProps {
  items: WatchHistory[];
  currentUser: LoungeUser;
  t: Translations;
  onResume: (item: MediaItem, resumePosition: number) => void;
  onSelect: (item: MediaItem) => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  items,
  currentUser,
  t,
  onResume,
  onSelect,
}) => {
  if (items.length === 0) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-3 py-2">
      {/* Header */}
      <div className="flex items-baseline justify-between px-1 sm:px-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">
            <Clock className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              متابعة المشاهدة • Continue Watching
            </h3>
            <p className="text-[11px] text-slate-400 -mt-0.5">
              استكمل أعمالك من نفس الدقيقة التي توقفت عندها
            </p>
          </div>
        </div>
      </div>

      {/* Cards Row */}
      <div className="flex items-stretch gap-4 overflow-x-auto overflow-y-hidden scrollbar-none py-2 px-1 sm:px-2">
        {items.map((entry) => {
          const item = entry.media_item;
          return (
            <div
              key={entry.id}
              className="group relative w-60 sm:w-72 shrink-0 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-500/50 shadow-lg transition-all duration-300 flex flex-col"
            >
              {/* Backdrop & Play Action */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer" onClick={() => onResume(item, entry.position_seconds)}>
                <img
                  src={item.backdrop_url || item.poster_url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                />

                {/* Center Hover Play Button */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                  <div className="w-11 h-11 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40 group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-current translate-x-0.5" />
                  </div>
                </div>

                {/* Duration / Position Badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono text-white">
                  {formatTime(entry.position_seconds)} / {item.duration_minutes || 120}:00
                </div>

                {/* Progress Bar at Bottom of Image */}
                <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
                    style={{ width: `${entry.completion_percentage}%` }}
                  />
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-3 flex items-center justify-between gap-2 bg-slate-900/90">
                <div className="overflow-hidden">
                  <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                  <span className="text-[11px] text-slate-400 block truncate">
                    متبقي {Math.max(1, (item.duration_minutes || 120) - Math.floor(entry.position_seconds / 60))} دقيقة
                  </span>
                </div>

                <button
                  onClick={() => onSelect(item)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/60 shrink-0 cursor-pointer"
                >
                  التفاصيل
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
