import React from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { PermissionEngineClient } from '../../services/permissionEngine';
import { Play, Info, Crown, Star, Server, Sparkles, Volume2, ShieldCheck } from 'lucide-react';

interface HeroBillboardProps {
  item: MediaItem;
  currentUser: LoungeUser;
  t: Translations;
  onPlay: (item: MediaItem) => void;
  onSelect: (item: MediaItem) => void;
}

export const HeroBillboard: React.FC<HeroBillboardProps> = ({
  item,
  currentUser,
  t,
  onPlay,
  onSelect
}) => {
  const evaluation = PermissionEngineClient.evaluateMediaAccess(currentUser, item);
  const canStream = evaluation.can_stream;

  return (
    <div className="relative w-full h-[460px] sm:h-[540px] rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl mb-8 select-none">
      {/* Background Backdrop with Gradient Overlays */}
      <img
        src={item.backdrop_url || item.poster_url}
        alt={item.title}
        className="w-full h-full object-cover object-center filter brightness-[0.72] transform scale-100 hover:scale-105 transition-transform duration-1000 ease-out"
      />

      {/* Cinematic Vignette Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />

      {/* Content Meta Container */}
      <div className="absolute bottom-0 inset-x-0 p-6 sm:p-12 z-10 max-w-3xl space-y-4 text-right">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-xs font-bold font-mono shadow-md">
            {item.resolution}
          </span>

          <span className="px-2.5 py-1 rounded-md bg-slate-900/90 text-slate-200 text-xs font-mono border border-slate-700/80 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>LAN DirectPlay</span>
          </span>

          {item.is_premium && (
            <span className="px-2.5 py-1 rounded-md bg-purple-900/90 text-purple-200 text-xs font-bold flex items-center gap-1 border border-purple-500/30">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              VIP Premium
            </span>
          )}

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-xs text-amber-400 text-xs font-bold border border-slate-800">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{item.rating}</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-black text-white drop-shadow-lg tracking-tight leading-tight">
          {item.title}
        </h1>

        {/* Overview Text */}
        <p className="text-sm sm:text-base text-slate-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-2xl font-sans drop-shadow">
          {item.overview}
        </p>

        {/* Genres & Languages tags */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="text-slate-300 font-semibold">{item.year}</span>
          <span>•</span>
          <span>{item.duration_minutes} {t.minutes}</span>
          <span>•</span>
          <span className="text-slate-300">{item.genres.join(' • ')}</span>
        </div>

        {/* Call to Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => onPlay(item)}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 transition-transform active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            {t.watchNow}
          </button>

          <button
            onClick={() => onSelect(item)}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-sm border border-slate-700/80 backdrop-blur-sm transition-colors"
          >
            <Info className="w-4 h-4" />
            {t.moreInfo}
          </button>
        </div>
      </div>
    </div>
  );
};
