import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, LoungeUser, PlaybackSession, PlaybackStartResponse } from '../../types';
import { Translations } from '../../lib/i18n';
import { PlaybackApiService } from '../../services/playbackEngine';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Server,
  ShieldCheck,
  Film,
  Subtitles,
  Check,
  RotateCcw,
  RotateCw,
  Gauge,
  Sparkles,
  Lock,
  Layers
} from 'lucide-react';

interface PlaybackModalProps {
  item: MediaItem;
  currentUser: LoungeUser;
  initialPosition?: number;
  t: Translations;
  onClose: () => void;
}

export const PlaybackModal: React.FC<PlaybackModalProps> = ({
  item,
  currentUser,
  initialPosition = 0,
  t,
  onClose,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(85);
  const [selectedQuality, setSelectedQuality] = useState(item.resolution || '1080p FHD');
  const [selectedAudio, setSelectedAudio] = useState(item.audio_languages[0] || 'عربي (دبلجة)');
  const [selectedSubtitle, setSelectedSubtitle] = useState(item.subtitle_languages[0] || 'العربية');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'quality' | 'audio' | 'subtitles' | 'speed'>('quality');

  // Video timeline states
  const totalDuration = (item.duration_minutes || 118) * 60;
  const [currentTime, setCurrentTime] = useState(initialPosition);
  const [bufferedTime, setBufferedTime] = useState(initialPosition + 240);

  // Playback Session Info from Backend
  const [sessionInfo, setSessionInfo] = useState<PlaybackStartResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize Playback Session on Mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsLoadingSession(true);
      const device = {
        id: 'dev-browser-current',
        user_id: currentUser.id,
        device_fingerprint: 'fp_web_browser_client',
        device_type: 'DESKTOP' as const,
        device_name: currentUser.connected_device || 'جهاز المتصفح الحالي',
        is_trusted: true,
        is_blocked: false,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      const result = await PlaybackApiService.startPlayback(currentUser, device, {
        media_item_id: item.id,
        quality: selectedQuality,
        resume: initialPosition > 0,
      });

      if (!isMounted) return;

      if (result.error) {
        setSessionError(result.error);
        setIsLoadingSession(false);
        return;
      }

      if (result.response) {
        setSessionInfo(result.response);
        setSessionId(result.response.playback_session_id);
        setCurrentTime(result.response.resume_position || initialPosition);
        setSelectedQuality(result.response.quality);
        setIsLoadingSession(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [item.id]);

  // 2. Playback Timer Simulation
  useEffect(() => {
    if (isPlaying && !isLoadingSession && !sessionError) {
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + playbackSpeed;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
        setBufferedTime((prev) => Math.min(totalDuration, prev + 2 * playbackSpeed));
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDuration, isLoadingSession, sessionError]);

  // 3. Heartbeat Loop every 30 seconds
  useEffect(() => {
    if (!sessionId || isLoadingSession || sessionError) return;

    heartbeatRef.current = setInterval(async () => {
      try {
        const hb = await PlaybackApiService.sendHeartbeat({
          playback_session_id: sessionId,
          position_seconds: Math.floor(currentTime),
          status: isPlaying ? 'PLAYING' : 'PAUSED',
          playback_rate: playbackSpeed,
        });

        if (hb.should_stop) {
          setIsPlaying(false);
          setSessionError(hb.stop_reason || 'تم إنهاء الجلسة عن بعد');
        }
      } catch {
        // silent fail for heartbeat
      }
    }, 30000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [sessionId, isPlaying, currentTime, playbackSpeed, isLoadingSession, sessionError]);

  // 4. Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(totalDuration, t + 10));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 10));
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted((m) => !m);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'Escape') {
        if (showSettingsMenu) setShowSettingsMenu(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalDuration, showSettingsMenu]);

  // 5. Cleanup & Save Progress on Unmount
  const handleClosePlayer = async () => {
    if (sessionId) {
      await PlaybackApiService.stopPlayback(sessionId, Math.floor(currentTime), item, currentUser);
    }
    onClose();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercentage = Math.min(100, (currentTime / totalDuration) * 100);
  const bufferPercentage = Math.min(100, (bufferedTime / totalDuration) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 md:p-8 animate-fadeIn">
      <div
        ref={containerRef}
        className="relative w-full max-w-6xl bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none"
      >
        {/* Top Floating Header */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm sm:text-base leading-tight">{item.title}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Server className="w-3.5 h-3.5" />
                  {item.library_name || 'Lounge Media Server'}
                </span>
                <span>•</span>
                <span className="text-amber-300 font-mono text-[11px] bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  {selectedQuality}
                </span>
                <span>•</span>
                <span className="text-slate-400 text-[11px]">{sessionInfo?.playback_method || 'DIRECT_PLAY'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClosePlayer}
            className="w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700/60 shadow cursor-pointer"
            title={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas & Frame Area */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
          {/* Backdrop Graphic Simulation */}
          <img
            src={item.backdrop_url || item.poster_url}
            alt={item.title}
            className={`w-full h-full object-cover transition-all duration-700 ${
              isPlaying ? 'opacity-50 filter brightness-90' : 'opacity-25 filter blur-xs'
            }`}
          />

          {/* Anti-Screen-Recording & Watermark Security Overlay */}
          <div className="absolute top-16 right-4 z-20 pointer-events-none opacity-40 hover:opacity-90 transition-opacity">
            <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 border border-slate-800 space-y-0.5 text-right">
              <div>Lounge ID: {currentUser.lounge_id}</div>
              <div>IP: {currentUser.ip_address || '10.0.0.124'}</div>
              <div>Token: {sessionInfo?.token ? sessionInfo.token.substring(0, 10) + '...' : 'Signed'}</div>
            </div>
          </div>

          {/* LAN Direct Stream Node Badge */}
          <div className="absolute top-16 left-4 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-xs text-[11px] text-slate-300 border border-slate-800/80 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LAN Direct Stream • 10.0.0.50:8096</span>
          </div>

          {/* Center Play/Pause Large Action Trigger */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-500/40 transition-transform active:scale-95 group-hover:scale-105 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Settings Flyout Drawer */}
          {showSettingsMenu && (
            <div className="absolute bottom-20 right-6 z-40 w-72 bg-slate-900/98 backdrop-blur-xl rounded-2xl p-4 border border-slate-700 shadow-2xl text-xs space-y-3 animate-fadeIn">
              {/* Settings Nav Tabs */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-amber-400" />
                  إعدادات التشغيل
                </span>
                <button
                  onClick={() => setShowSettingsMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-xl">
                {[
                  { id: 'quality', label: 'الجودة' },
                  { id: 'audio', label: 'الصوت' },
                  { id: 'subtitles', label: 'الترجمة' },
                  { id: 'speed', label: 'السرعة' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id as any)}
                    className={`py-1 rounded-lg text-center font-medium transition-colors ${
                      activeSettingsTab === tab.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content: Quality */}
              {activeSettingsTab === 'quality' && (
                <div className="space-y-1 pt-1">
                  {(sessionInfo?.available_qualities || [
                    '4K UHD (DirectPlay)',
                    '1080p FHD (DirectPlay)',
                    '720p HD (DirectStream)',
                    '480p (Transcode)',
                  ]).map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setSelectedQuality(q);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors ${
                        selectedQuality === q
                          ? 'bg-amber-500/20 text-amber-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{q}</span>
                        {q.includes('4K') && !currentUser.active_profile.permissions.includes('4K_STREAMING') && (
                          <span className="text-[10px] text-amber-400/80">خاص بباقة VIP</span>
                        )}
                      </div>
                      {selectedQuality === q && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content: Audio */}
              {activeSettingsTab === 'audio' && (
                <div className="space-y-1 pt-1">
                  {item.audio_languages.map((a) => (
                    <button
                      key={a}
                      onClick={() => {
                        setSelectedAudio(a);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors ${
                        selectedAudio === a
                          ? 'bg-amber-500/20 text-amber-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{a}</span>
                      {selectedAudio === a && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content: Subtitles */}
              {activeSettingsTab === 'subtitles' && (
                <div className="space-y-1 pt-1">
                  {['إيقاف الترجمة', ...item.subtitle_languages].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSubtitle(s);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors ${
                        selectedSubtitle === s
                          ? 'bg-amber-500/20 text-amber-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{s}</span>
                      {selectedSubtitle === s && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Tab Content: Speed */}
              {activeSettingsTab === 'speed' && (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setPlaybackSpeed(spd);
                        setShowSettingsMenu(false);
                      }}
                      className={`py-2 rounded-xl text-center font-mono font-bold transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Player Controls Overlay */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-2">
            {/* Timeline Bar with Buffer and Progress */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-300 font-mono w-10 text-right">
                {formatTime(currentTime)}
              </span>

              <div
                className="flex-1 h-2 bg-slate-800/80 rounded-full cursor-pointer relative group/bar overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  setCurrentTime(Math.floor(ratio * totalDuration));
                }}
              >
                {/* Buffered stream bar */}
                <div
                  className="h-full bg-slate-700 rounded-full absolute top-0 left-0 transition-all duration-300"
                  style={{ width: `${bufferPercentage}%` }}
                />

                {/* Current Play progress */}
                <div
                  className="h-full bg-amber-500 rounded-full relative z-10"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-mono w-10 text-left">
                {formatTime(totalDuration)}
              </span>
            </div>

            {/* Bottom Button Row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Play / Pause */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="text-slate-200 hover:text-amber-400 transition-colors p-1"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                {/* Seek Back 10s */}
                <button
                  onClick={() => setCurrentTime((t) => Math.max(0, t - 10))}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title="تراجع 10 ثوان"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                {/* Seek Forward 10s */}
                <button
                  onClick={() => setCurrentTime((t) => Math.min(totalDuration, t + 10))}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title="تقديم 10 ثوان"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-300 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5 text-red-400" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500 hidden sm:block"
                  />
                </div>

                {/* Audio & Subtitle Indicator badges */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {selectedAudio}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1">
                    <Subtitles className="w-3 h-3 text-slate-400" />
                    {selectedSubtitle}
                  </span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Speed indicator */}
                {playbackSpeed !== 1.0 && (
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {playbackSpeed}x
                  </span>
                )}

                {/* Settings Button */}
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className={`p-2 rounded-xl transition-colors ${
                    showSettingsMenu
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-amber-400 hover:bg-slate-800'
                  }`}
                  title="إعدادات الصوت والجودة"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-slate-300 hover:text-white transition-colors rounded-xl hover:bg-slate-800"
                  title="شاشة كاملة"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Player Footer Notice */}
        <div className="bg-slate-900/90 px-4 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {t.playingStream} ({currentUser.full_name} • {currentUser.active_profile.name})
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
            <span>Bitrate: 22.8 Mbps</span>
            <span>•</span>
            <span>Codec: HEVC / AAC-LC</span>
            <span>•</span>
            <span className="text-emerald-400">DirectPlay (Zero Transcode)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
