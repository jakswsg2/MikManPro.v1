import React, { useState } from 'react';
import { 
  Play, 
  Download, 
  Lock, 
  CheckCircle2, 
  Sparkles, 
  Film, 
  Tv2, 
  Baby, 
  Crown, 
  Search, 
  Info,
  Clock,
  Star,
  Layers,
  Volume2,
  FileText,
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { LoungeUser, MediaItem } from '../types';
import { PermissionEngineClient } from '../services/permissionEngine';

interface MediaBrowserProps {
  currentUser: LoungeUser;
  mediaItems: MediaItem[];
  onUpgradeToVIP?: () => void;
}

export const MediaBrowser: React.FC<MediaBrowserProps> = ({
  currentUser,
  mediaItems,
  onUpgradeToVIP,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeMediaModal, setActiveMediaModal] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

  const canDownloadGlobal = PermissionEngineClient.canDownload(currentUser);

  // Filter items based on user profile and search
  const filteredItems = mediaItems.filter((item) => {
    // Search filter
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.original_title && item.original_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.genres.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Category filter
    if (selectedCategory === 'movies') return item.item_type === 'movie' && !item.is_kids;
    if (selectedCategory === 'series') return item.item_type === 'series' && !item.is_kids;
    if (selectedCategory === 'kids') return item.is_kids;
    if (selectedCategory === 'premium') return item.is_premium;

    return true;
  });

  const handleDownload = (item: MediaItem, accessAllowed: boolean) => {
    if (!canDownloadGlobal || !accessAllowed) return;
    setDownloadNotification(`بدأ التحميل المباشر لـ "${item.title}" عبر شبكة الـ LAN بسرعة 85 MB/s`);
    setTimeout(() => setDownloadNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Live User Context & Permission Overview Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>واجهة المشاهدة الحية</span>
              </span>
              <span className="text-xs text-slate-400">
                تسجيل دخول المستخدم: <strong className="text-slate-200">{currentUser.full_name}</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              مكتبة الاستراحة الذكية — Smart Lounge Media Catalog
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              يتم فلترة المحتوى وإمكانيات التحميل ديناميكياً بحسب صلاحيات البروفايل المعين لك من مدير الشبكة.
            </p>
          </div>

          {/* Entitlement Summary Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              PermissionEngineClient.hasPermission(currentUser, 'content.movies.view')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <Film className="w-3.5 h-3.5" />
              <span>الأفلام: {PermissionEngineClient.hasPermission(currentUser, 'content.movies.view') ? 'مسموح' : 'محظور'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              PermissionEngineClient.hasPermission(currentUser, 'content.series.view')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <Tv2 className="w-3.5 h-3.5" />
              <span>المسلسلات: {PermissionEngineClient.hasPermission(currentUser, 'content.series.view') ? 'مسموح' : 'محظور'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              PermissionEngineClient.hasPermission(currentUser, 'content.premium.view')
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Crown className="w-3.5 h-3.5" />
              <span>محتوى VIP: {PermissionEngineClient.hasPermission(currentUser, 'content.premium.view') ? 'مسموح' : 'غير متاح'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              canDownloadGlobal
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Download className="w-3.5 h-3.5" />
              <span>التحميل: {canDownloadGlobal ? 'مسموح' : 'غير مصرح'}</span>
            </div>
          </div>
        </div>

        {/* Download notification banner */}
        {downloadNotification && (
          <div className="mt-4 p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 animate-bounce text-blue-400" />
              <span>{downloadNotification}</span>
            </div>
            <button onClick={() => setDownloadNotification(null)} className="text-blue-400 hover:text-blue-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-2 rounded-2xl border border-slate-800/80">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: 'all', label: 'الكل', count: mediaItems.length },
            { id: 'movies', label: 'الأفلام', count: mediaItems.filter(i => i.item_type === 'movie' && !i.is_kids).length },
            { id: 'series', label: 'المسلسلات', count: mediaItems.filter(i => i.item_type === 'series' && !i.is_kids).length },
            { id: 'kids', label: 'الأطفال', count: mediaItems.filter(i => i.is_kids).length },
            { id: 'premium', label: 'سينما VIP 4K', count: mediaItems.filter(i => i.is_premium).length },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === cat.id ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالعنوان، التصنيف، الممثلين..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredItems.map((item) => {
          const access = PermissionEngineClient.canAccessMediaItem(currentUser, item);
          const isAllowed = access.allowed;

          return (
            <div
              key={item.id}
              className={`group rounded-2xl overflow-hidden bg-slate-900/80 border transition-all flex flex-col justify-between ${
                isAllowed
                  ? 'border-slate-800 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5'
                  : 'border-slate-800/80 opacity-80'
              }`}
            >
              <div>
                {/* Poster Box */}
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
                  <img
                    src={item.poster_url}
                    alt={item.title}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      !isAllowed ? 'grayscale contrast-125 brightness-50' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  {/* Resolution & Rating Badges */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-950/80 text-amber-400 border border-amber-500/30 backdrop-blur-sm">
                      {item.resolution}
                    </span>
                    {item.is_premium && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 flex items-center gap-1 shadow-md">
                        <Crown className="w-3 h-3" />
                        VIP
                      </span>
                    )}
                    {item.is_kids && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 flex items-center gap-1">
                        <Baby className="w-3 h-3" />
                        أطفال
                      </span>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="absolute top-2.5 left-2.5 bg-slate-950/80 px-2 py-0.5 rounded-md text-[11px] font-bold text-amber-400 border border-slate-800 backdrop-blur-sm flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{item.rating}</span>
                  </div>

                  {/* Lock Screen if Not Allowed */}
                  {!isAllowed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/70 backdrop-blur-xs">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-2">
                        <Lock className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-white">محتوى مقفل</span>
                      <p className="text-[10px] text-slate-300 mt-1 max-w-[200px] leading-tight">
                        {access.reason}
                      </p>
                      {item.is_premium && onUpgradeToVIP && (
                        <button
                          onClick={onUpgradeToVIP}
                          className="mt-2.5 px-3 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-bold hover:bg-amber-400 transition-colors flex items-center gap-1"
                        >
                          <Crown className="w-3 h-3" />
                          تبديل لمستخدم VIP للاختبار
                        </button>
                      )}
                    </div>
                  )}

                  {/* Floating Play Button on Hover */}
                  {isAllowed && (
                    <button
                      onClick={() => {
                        setActiveMediaModal(item);
                        setIsPlaying(true);
                      }}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/40 backdrop-blur-xs"
                      title="تشغيل فوري"
                    >
                      <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-6 h-6 fill-slate-950 mr-0.5" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Content Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
                        {item.title}
                      </h3>
                      {item.original_title && (
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {item.original_title}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                      {item.year}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {item.overview}
                  </p>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {item.genres.map((g) => (
                      <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
                        {g}
                      </span>
                    ))}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/50 text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.duration_minutes} د
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setActiveMediaModal(item);
                    setIsPlaying(isAllowed);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isAllowed
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/10'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                  }`}
                >
                  {isAllowed ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>مشاهدة الآن</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>تفاصيل القفل</span>
                    </>
                  )}
                </button>

                {/* Download Button strictly guarded by permission */}
                <button
                  onClick={() => handleDownload(item, isAllowed)}
                  disabled={!isAllowed || !canDownloadGlobal}
                  title={
                    !canDownloadGlobal
                      ? 'التحميل محظور: بروفايلك لا يملك صلاحية (content.download)'
                      : !isAllowed
                      ? 'المحتوى مقفل'
                      : 'تحميل مباشر عبر شبكة الاستراحة المحلية'
                  }
                  className={`p-2 rounded-xl border text-xs flex items-center justify-center transition-all ${
                    isAllowed && canDownloadGlobal
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                      : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Media Player / Details Modal */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header / Video Stage */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {isPlaying ? (
                <div className="w-full h-full relative flex flex-col items-center justify-center bg-slate-950">
                  <img
                    src={activeMediaModal.backdrop_url || activeMediaModal.poster_url}
                    alt={activeMediaModal.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xs"
                  />
                  {/* Simulated HLS Player UI */}
                  <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 animate-pulse">
                      <Play className="w-8 h-8 fill-amber-400 mr-1" />
                    </div>
                    <div>
                      <div className="text-amber-400 text-xs font-mono">LAN Stream Active (Jellyfin / Emby)</div>
                      <h4 className="text-base font-bold text-white">{activeMediaModal.title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        192.168.1.50 • Bitrate: 42.5 Mbps • Codec: HEVC/H.265 Direct Play
                      </p>
                    </div>

                    {/* Quality & Subtitle Track Selectors */}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {activeMediaModal.resolution}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        صوت: {activeMediaModal.audio_languages[0] || 'عربي'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        ترجمة: {activeMediaModal.subtitle_languages[0] || 'عربي'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <img
                    src={activeMediaModal.backdrop_url || activeMediaModal.poster_url}
                    alt={activeMediaModal.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => {
                  setActiveMediaModal(null);
                  setIsPlaying(false);
                }}
                className="absolute top-4 left-4 p-2 rounded-full bg-slate-950/70 hover:bg-slate-900 text-slate-300 border border-slate-700/60 transition-colors z-20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{activeMediaModal.title}</span>
                    {activeMediaModal.is_premium && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">
                        VIP 4K
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>{activeMediaModal.year}</span>
                    <span>•</span>
                    <span>{activeMediaModal.duration_minutes} دقيقة</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {activeMediaModal.rating}
                    </span>
                    <span>•</span>
                    <span className="text-slate-300 font-medium">{activeMediaModal.library_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>{isPlaying ? 'إيقاف البث' : 'تشغيل فوري'}</span>
                  </button>

                  <button
                    onClick={() => handleDownload(activeMediaModal, true)}
                    disabled={!canDownloadGlobal}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      canDownloadGlobal
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>{canDownloadGlobal ? 'تحميل LAN' : 'التحميل محظور'}</span>
                  </button>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {activeMediaModal.overview}
              </p>

              {/* Seasons & Episodes if Series */}
              {activeMediaModal.seasons && activeMediaModal.seasons.length > 0 && (
                <div className="pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>المواسم والحلقات المتاحة على الخادم</span>
                  </h4>
                  <div className="space-y-2">
                    {activeMediaModal.seasons.map((season) => (
                      <div key={season.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        <div className="text-xs font-bold text-amber-400 mb-2">{season.title}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {season.episodes.map((ep) => (
                            <div
                              key={ep.id}
                              onClick={() => setIsPlaying(true)}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer transition-colors text-xs border border-slate-800"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center font-mono text-[11px] text-slate-300">
                                  {ep.episode_number}
                                </span>
                                <span className="text-slate-200 font-medium">{ep.title}</span>
                              </div>
                              <span className="text-slate-500 text-[10px]">{ep.duration_minutes} د</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
