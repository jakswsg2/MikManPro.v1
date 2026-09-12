import React, { useState, useEffect } from 'react';
import { MediaItem, LoungeUser, WatchHistory } from '../../types';
import { Translations } from '../../lib/i18n';
import { PermissionEngineClient } from '../../services/permissionEngine';
import { WatchHistoryService } from '../../services/playbackEngine';
import { 
  X, Play, Download, Crown, Sparkles, Server, Clock, Calendar, 
  Star, Film, Tv, CheckCircle2, AlertTriangle, Layers, ArrowDownCircle, Check,
  ExternalLink, RotateCcw
} from 'lucide-react';

interface ContentDetailModalProps {
  item: MediaItem;
  currentUser: LoungeUser;
  t: Translations;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onOpenExternalPlayer?: (item: MediaItem) => void;
  onUpgradeToVIP?: () => void;
}

export const ContentDetailModal: React.FC<ContentDetailModalProps> = ({
  item,
  currentUser,
  t,
  onClose,
  onPlay,
  onOpenExternalPlayer,
  onUpgradeToVIP
}) => {
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [resumeHistory, setResumeHistory] = useState<WatchHistory | null>(null);

  useEffect(() => {
    const resume = WatchHistoryService.getResumePosition(currentUser.id, item.id);
    setResumeHistory(resume);
  }, [currentUser.id, item.id]);

  const evaluation = PermissionEngineClient.evaluateMediaAccess(currentUser, item);
  const effectivePerms = PermissionEngineClient.getEffectivePermissions(currentUser);
  const canDownload = effectivePerms.has('content.download');
  const canStream = evaluation.can_stream;

  const handleDownloadClick = () => {
    if (!canDownload) return;
    setDownloadProgress(10);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setDownloadProgress(null), 2500);
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl my-auto text-right">
        {/* Backdrop Banner Header */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
          <img
            src={item.backdrop_url || item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover filter brightness-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-colors border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title & Quick Actions floating on banner */}
          <div className="absolute bottom-6 right-6 left-6 z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-xs font-bold font-mono">
                {item.resolution}
              </span>
              {item.is_premium && (
                <span className="px-2.5 py-1 rounded-md bg-purple-900/90 text-purple-200 text-xs font-bold flex items-center gap-1 border border-purple-500/30">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  VIP Premium
                </span>
              )}
              {item.is_kids && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-900/90 text-emerald-200 text-xs font-bold border border-emerald-500/30">
                  {t.kids}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white drop-shadow-md">
              {item.title}
            </h2>

            {item.original_title && (
              <p className="text-sm text-slate-300 font-sans tracking-wide">
                {item.original_title}
              </p>
            )}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 space-y-6">
          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              {canStream ? (
                <>
                  <button
                    onClick={() => onPlay(item)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    {resumeHistory ? (
                      <span>متابعة من {Math.floor(resumeHistory.position_seconds / 60)}:00</span>
                    ) : (
                      <span>{t.watchNow}</span>
                    )}
                  </button>

                  {onOpenExternalPlayer && (
                    <button
                      onClick={() => onOpenExternalPlayer(item)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-sm font-semibold border border-slate-700/80 transition-colors cursor-pointer"
                      title="تشغيل عبر VLC أو Infuse أو Kodi"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>مشغل خارجي</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2.5 rounded-xl bg-purple-950/80 border border-purple-800/80 text-purple-200 text-xs flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{t.vipRestrictedDesc}</span>
                  </div>
                  {onUpgradeToVIP && (
                    <button
                      onClick={onUpgradeToVIP}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all"
                    >
                      {t.upgradeToVIP}
                    </button>
                  )}
                </div>
              )}

              {/* Direct LAN Download Button */}
              {canDownload ? (
                <button
                  onClick={handleDownloadClick}
                  disabled={downloadProgress !== null}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                >
                  {downloadProgress !== null ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      <span>{t.downloading} ({downloadProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-amber-400" />
                      <span>{t.download}</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="relative group/dl">
                  <button
                    disabled
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/40 text-slate-400 text-sm font-semibold border border-slate-800 cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.download}</span>
                  </button>
                  <div className="absolute bottom-full mb-2 right-0 hidden group-hover/dl:block w-64 p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 shadow-xl z-30">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t.downloadNotAllowed}
                    </div>
                    <p className="text-[11px] text-slate-400">{t.downloadRestrictedDesc}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Meta Badges */}
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="font-bold text-white text-sm">{item.rating}</span>
                <span className="text-slate-400">/ 10</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{item.year}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{item.duration_minutes} {t.minutes}</span>
              </span>
            </div>
          </div>

          {/* Overview & Genres */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-200">{t.overview}</h4>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {item.overview}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {item.genres.map((g) => (
                <span key={g} className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs border border-slate-700/60">
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* Audio & Subtitle Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">{t.audioTracks}:</span>
              <div className="flex flex-wrap gap-1.5">
                {item.audio_languages.map((a) => (
                  <span key={a} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold block mb-1.5">{t.subtitles}:</span>
              <div className="flex flex-wrap gap-1.5">
                {item.subtitle_languages.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Physical LAN Servers Breakdown (Multi-Source Node Info) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                {t.serversAvailable}
              </span>
              <span className="text-[11px] font-mono text-emerald-400">LAN Ultra-Low Latency (0.4ms)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Lounge Media Server 01 (Jellyfin)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">192.168.1.50:8096 • DirectPlay</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
                  {item.resolution}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Lounge Backup Server (Emby)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">192.168.1.55:8096 • Transcode Ready</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold">
                  1080p FHD
                </span>
              </div>
            </div>
          </div>

          {/* If Series: Seasons & Episodes Navigation */}
          {item.item_type === 'series' && item.seasons && item.seasons.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Tv className="w-4 h-4 text-amber-400" />
                  {t.seasons} &amp; {t.episodes}
                </h4>

                {/* Season Picker */}
                <div className="flex items-center gap-2">
                  {item.seasons.map((season, idx) => (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeasonIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedSeasonIndex === idx
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {t.season} {season.season_number}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episodes List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {item.seasons[selectedSeasonIndex]?.episodes.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => canStream && onPlay(item)}
                    className={`p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 transition-colors ${
                      canStream ? 'hover:border-amber-500/50 cursor-pointer group' : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 flex items-center justify-center font-bold text-xs transition-colors shrink-0">
                        {ep.episode_number}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                          {ep.title}
                        </h5>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ep.duration_minutes} {t.minutes}
                        </span>
                      </div>
                    </div>

                    <Play className="w-4 h-4 text-slate-400 group-hover:text-amber-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
