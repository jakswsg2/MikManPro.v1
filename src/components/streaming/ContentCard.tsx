import React from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { PermissionEngineClient } from '../../services/permissionEngine';
import { Play, Info, Crown, Star, Lock, Clock } from 'lucide-react';

interface ContentCardProps {
  item: MediaItem;
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  progressPercent?: number;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  currentUser,
  t,
  onSelect,
  onPlay,
  progressPercent
}) => {
  const evaluation = PermissionEngineClient.evaluateMediaAccess(currentUser, item);
  const isRestricted = !evaluation.can_stream;

  return (
    <div className="group relative flex-none w-44 sm:w-52 select-none transition-all duration-300 transform hover:scale-[1.04] hover:z-20">
      {/* Poster Container */}
      <div 
        onClick={() => onSelect(item)}
        className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-lg cursor-pointer group-hover:border-slate-600 transition-colors"
      >
        <img
          src={item.poster_url}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Top Badges */}
        <div className="absolute top-2 right-2 left-2 flex items-center justify-between pointer-events-none z-10">
          <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-bold font-mono text-amber-400 border border-slate-700/60">
            {item.resolution.includes('4K') ? '4K UHD' : '1080p'}
          </span>

          {item.is_premium && (
            <span className="px-1.5 py-0.5 rounded bg-purple-900/90 text-purple-200 text-[10px] font-bold flex items-center gap-1 border border-purple-500/30">
              <Crown className="w-3 h-3 text-amber-400" />
              VIP
            </span>
          )}
        </div>

        {/* Restricted Overlay if User doesn't have permission */}
        {isRestricted && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-3 text-center z-10">
            <div className="w-9 h-9 rounded-full bg-purple-900/80 border border-purple-500/40 text-amber-400 flex items-center justify-center mb-1.5">
              <Lock className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-white leading-tight">محتوى VIP</span>
            <span className="text-[10px] text-slate-300 mt-0.5">يتطلب باقة Premium</span>
          </div>
        )}

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRestricted) onPlay(item);
                else onSelect(item);
              }}
              className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-md transition-transform active:scale-95"
              title={t.watchNow}
            >
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item);
              }}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-600 transition-colors"
              title={t.moreInfo}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <div className="text-right">
            <h4 className="text-xs font-bold text-white truncate drop-shadow">{item.title}</h4>
            <div className="flex items-center justify-between text-[10px] text-slate-300 mt-1">
              <span>{item.year}</span>
              <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                <Star className="w-3 h-3 fill-current" />
                {item.rating}
              </span>
            </div>
          </div>
        </div>

        {/* Optional Continue Watching Progress Bar */}
        {progressPercent !== undefined && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-800">
            <div 
              className="h-full bg-amber-500" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        )}
      </div>

      {/* Card Footer Text */}
      <div className="mt-2 text-right px-0.5">
        <h4 className="text-xs font-semibold text-slate-200 truncate group-hover:text-amber-400 transition-colors">
          {item.title}
        </h4>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
          <span className="truncate max-w-[110px]">{item.genres.slice(0, 2).join(' • ')}</span>
          <span className="font-mono text-[10px]">{item.duration_minutes}m</span>
        </div>
      </div>
    </div>
  );
};
