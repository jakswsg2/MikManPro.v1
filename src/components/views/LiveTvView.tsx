import React, { useState, useMemo } from 'react';
import { LiveChannel, SportsMatch, LoungeUser, LiveChannelCategory } from '../../types';
import { INITIAL_LIVE_CHANNELS, INITIAL_SPORTS_MATCHES } from '../../data/liveTvData';
import { Translations } from '../../lib/i18n';
import { 
  Tv, Radio, Trophy, Play, Clock, Signal, Volume2, ShieldCheck, 
  ExternalLink, Sparkles, Filter, Calendar, Activity, CheckCircle2, ChevronRight
} from 'lucide-react';

interface LiveTvViewProps {
  currentUser: LoungeUser;
  t: Translations;
  onPlayChannel?: (channel: LiveChannel) => void;
}

export const LiveTvView: React.FC<LiveTvViewProps> = ({
  currentUser,
  t,
  onPlayChannel
}) => {
  const [channels, setChannels] = useState<LiveChannel[]>(INITIAL_LIVE_CHANNELS);
  const [matches, setMatches] = useState<SportsMatch[]>(INITIAL_SPORTS_MATCHES);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'channels' | 'epg' | 'sports'>('sports');
  const [selectedChannelForPlay, setSelectedChannelForPlay] = useState<LiveChannel | null>(null);
  const [streamQuality, setStreamQuality] = useState<'DIRECT' | 'TRANSCODE_720P'>('DIRECT');

  const categories: { id: string; label: string; icon: string }[] = [
    { id: 'ALL', label: 'جميع القنوات', icon: '📺' },
    { id: 'SPORTS', label: 'الرياضة والمباريات', icon: '⚽' },
    { id: 'MOVIES', label: 'الأفلام والسينما', icon: '🎬' },
    { id: 'DOCUMENTARY', label: 'وثائقي واستكشاف', icon: '🌍' },
    { id: 'NEWS', label: 'الأخبار المباشرة', icon: '📰' },
    { id: 'ENTERTAINMENT', label: 'ترفيه ومنوعات', icon: '🎭' }
  ];

  const filteredChannels = useMemo(() => {
    if (selectedCategory === 'ALL') return channels;
    return channels.filter((c) => c.category === selectedCategory);
  }, [channels, selectedCategory]);

  const liveMatches = useMemo(() => {
    return matches.filter((m) => m.status === 'LIVE');
  }, [matches]);

  const upcomingMatches = useMemo(() => {
    return matches.filter((m) => m.status !== 'LIVE');
  }, [matches]);

  const handleStartPlay = (channel: LiveChannel) => {
    setSelectedChannelForPlay(channel);
    if (onPlayChannel) {
      onPlayChannel(channel);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>بث حي ومباشر عبر خوادم الـ LAN فائق السرعة 1000 Mbps</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Tv className="w-8 h-8 text-emerald-400" />
              <span>البث التلفزيوني الحي ودليل البرامج (Live TV & EPG)</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              شاهد قنواتك المفضلة وأقوى الدوريات الرياضية العالمية والمحلية مباشرة من بوابات الاستقبال المحلية بدون استهلاك لبيانات باقة الإنترنت وبزمن تأخير شبه معدوم.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-center px-2">
              <span className="block text-xl font-black text-emerald-400">{channels.length}</span>
              <span className="text-[10px] text-slate-400 font-bold">قنوات نشطة</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <span className="block text-xl font-black text-amber-400">{liveMatches.length}</span>
              <span className="text-[10px] text-slate-400 font-bold">مباريات الآن</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <span className="block text-xl font-black text-cyan-400">0 ms</span>
              <span className="text-[10px] text-slate-400 font-bold">تأخير الـ LAN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sports'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>مركز المباريات والرياضة ({matches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'channels'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>القنوات المباشرة ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('epg')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'epg'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>دليل البرامج الزمني (EPG Timeline)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Sports Match Center */}
      {activeTab === 'sports' && (
        <div className="space-y-6">
          {/* Live Matches Now */}
          {liveMatches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>مباريات تجري الآن (بث مباشر):</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveMatches.map((match) => (
                  <div
                    key={match.id}
                    className="group relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-red-500/30 p-5 shadow-xl transition-all hover:border-red-500/60"
                  >
                    {/* Match Tournament Header */}
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-4 pb-3 border-b border-slate-800">
                      <span className="font-bold text-slate-200">{match.tournament}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[11px] font-black animate-pulse">
                          مباشر {match.current_minute}
                        </span>
                      </div>
                    </div>

                    {/* Teams & Scores */}
                    <div className="flex items-center justify-between my-2">
                      {/* Home Team */}
                      <div className="flex-1 flex flex-col items-center text-center space-y-2">
                        <img
                          src={match.home_team.logo}
                          alt={match.home_team.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 shadow-md"
                        />
                        <span className="text-xs font-bold text-white line-clamp-1">{match.home_team.name}</span>
                      </div>

                      {/* Score Badge */}
                      <div className="px-5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-center shadow-inner">
                        <div className="text-2xl font-black text-amber-400 font-mono tracking-wider">
                          {match.home_team.score ?? 0} - {match.away_team.score ?? 0}
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold block mt-0.5">الشوط الثاني</span>
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 flex flex-col items-center text-center space-y-2">
                        <img
                          src={match.away_team.logo}
                          alt={match.away_team.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 shadow-md"
                        />
                        <span className="text-xs font-bold text-white line-clamp-1">{match.away_team.name}</span>
                      </div>
                    </div>

                    {/* Match Info & Direct Play Button */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="space-y-0.5">
                        <div>الملعب: <span className="text-slate-300 font-medium">{match.stadium}</span></div>
                        <div>التعليق: <span className="text-slate-300 font-medium">{match.commentator}</span></div>
                      </div>

                      <button
                        onClick={() => {
                          const targetCh = channels.find((c) => c.id === match.channel_id) || channels[0];
                          handleStartPlay(targetCh);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>شاهد البث ({match.channel_name.split(' ')[0]})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Matches */}
          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>مباريات قادمة ومجدولة اليوم:</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[11px] text-amber-400 font-bold block">{match.tournament}</span>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{match.home_team.name}</span>
                      <span className="text-slate-500 font-mono text-[10px]">ضد</span>
                      <span>{match.away_team.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      القناة: <span className="text-slate-300">{match.channel_name}</span> • المعلق: {match.commentator}
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-mono block text-center">
                      {new Date(match.start_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-slate-500 block text-center mt-1">تذكير تلقائي</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Live Channels Grid */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          {/* Categories Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Channels Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className="group relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-4 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Channel Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        <img
                          src={channel.logo_url}
                          alt={channel.name}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-400">CH {channel.number}</span>
                          {channel.is_premium && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              VIP
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                          {channel.name}
                        </h4>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 font-mono text-[10px] border border-slate-800">
                      {channel.resolution}
                    </span>
                  </div>

                  {/* Current Program info */}
                  {channel.current_program && (
                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>يعرض الآن:</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {channel.bitrate_mbps} Mbps
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 line-clamp-1">
                        {channel.current_program.title}
                      </p>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {channel.current_program.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Action */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                    {channel.server_source}
                  </span>

                  <button
                    onClick={() => handleStartPlay(channel)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل البث</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: EPG Timeline Guide */}
      {activeTab === 'epg' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-slate-300 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>جدول البث الزمني المباشر (24 Hour EPG Electronic Program Guide)</span>
            </h3>

            <div className="space-y-4 divide-y divide-slate-800">
              {channels.map((channel) => (
                <div key={channel.id} className="pt-4 first:pt-0 flex flex-col md:flex-row gap-4">
                  {/* Channel Header Left */}
                  <div className="w-full md:w-56 shrink-0 flex items-center gap-3">
                    <img
                      src={channel.logo_url}
                      alt={channel.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                    />
                    <div>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold block">CH {channel.number}</span>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{channel.name}</h4>
                    </div>
                  </div>

                  {/* Program Timeline */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Current */}
                    {channel.current_program && (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold">
                          <span>يعرض الآن (Live)</span>
                          <span className="font-mono">
                            {new Date(channel.current_program.start_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} - {new Date(channel.current_program.end_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-white">{channel.current_program.title}</h5>
                        <p className="text-[11px] text-slate-300 line-clamp-1">{channel.current_program.description}</p>
                      </div>
                    )}

                    {/* Next */}
                    {channel.upcoming_programs && channel.upcoming_programs[0] ? (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                          <span>البرنامج التالي</span>
                          <span className="font-mono">
                            {new Date(channel.upcoming_programs[0].start_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-200">{channel.upcoming_programs[0].title}</h5>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{channel.upcoming_programs[0].description}</p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-950/30 border border-slate-800/40 text-[11px] text-slate-500 flex items-center justify-center">
                        بث متواصل حسب جدول القناة
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Stream Player Modal Preview */}
      {selectedChannelForPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
            {/* Player Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedChannelForPlay.name}</h3>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    بث شبكة الـ LAN الحي • {selectedChannelForPlay.resolution}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedChannelForPlay(null)}
                className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Video Canvas Simulation */}
            <div className="relative aspect-video bg-black flex flex-col items-center justify-center overflow-hidden">
              <img
                src={selectedChannelForPlay.current_program?.thumbnail || selectedChannelForPlay.logo_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-35 filter blur-sm"
              />
              
              <div className="relative z-10 text-center space-y-3 p-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                  <Play className="w-8 h-8 fill-current translate-x-0.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    {selectedChannelForPlay.current_program?.title || selectedChannelForPlay.name}
                  </h4>
                  <p className="text-xs text-slate-300 font-mono">
                    Direct Stream • H.264/AAC • {selectedChannelForPlay.bitrate_mbps} Mbps • Buffer: 0.12s
                  </p>
                </div>
              </div>

              {/* Stream Overlay info */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950/80 backdrop-blur px-4 py-2 rounded-xl border border-slate-800">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Signal className="w-3.5 h-3.5" />
                  <span>Multicast IP: 239.255.1.10:8208</span>
                </span>
                <span>LAN Gateway Alpha</span>
              </div>
            </div>

            {/* Player Controls & Stream Quality options */}
            <div className="p-5 bg-slate-900/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">نمط البث:</span>
                <button
                  onClick={() => setStreamQuality('DIRECT')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    streamQuality === 'DIRECT'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Stream (بدون ترميز)
                </button>
                <button
                  onClick={() => setStreamQuality('TRANSCODE_720P')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    streamQuality === 'TRANSCODE_720P'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  موفر البيانات (720p 60fps)
                </button>
              </div>

              <button
                onClick={() => setSelectedChannelForPlay(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                إغلاق المشغل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
