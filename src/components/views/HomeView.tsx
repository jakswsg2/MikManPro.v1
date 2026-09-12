import React from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { HeroBillboard } from '../streaming/HeroBillboard';
import { ContentRow } from '../streaming/ContentRow';
import { ContinueWatchingRow } from '../streaming/ContinueWatchingRow';
import { WatchHistoryService } from '../../services/playbackEngine';
import { 
  Flame, Sparkles, Film, Tv, Baby, Clock, Crown, Wifi 
} from 'lucide-react';

interface HomeViewProps {
  mediaItems: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem, resumePosition?: number) => void;
  isLanOnline?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  mediaItems,
  currentUser,
  t,
  onSelect,
  onPlay,
  isLanOnline = true
}) => {
  const continueWatchingItems = WatchHistoryService.getContinueWatching(currentUser.id);
  const featuredItem = mediaItems.find((i) => i.is_premium) || mediaItems[0];

  const trendingItems = [...mediaItems].sort((a, b) => b.view_count - a.view_count);
  const newReleases = [...mediaItems].sort((a, b) => b.year - a.year);
  const topRated = [...mediaItems].sort((a, b) => b.rating - a.rating);
  const movies = mediaItems.filter((i) => i.item_type === 'movie');
  const series = mediaItems.filter((i) => i.item_type === 'series');
  const kidsItems = mediaItems.filter((i) => i.is_kids);

  return (
    <div className="space-y-6 pb-12">
      {/* Featured Hero Billboard */}
      {featuredItem && (
        <HeroBillboard
          item={featuredItem}
          currentUser={currentUser}
          t={t}
          onPlay={onPlay}
          onSelect={onSelect}
        />
      )}

      {/* Continue Watching Section */}
      {continueWatchingItems.length > 0 && (
        <ContinueWatchingRow
          items={continueWatchingItems}
          currentUser={currentUser}
          t={t}
          onSelect={onSelect}
          onResume={(item, pos) => onPlay(item, pos)}
        />
      )}

      {/* Network & Service Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white block text-sm">
              شبكة الاستراحة الذكية فائقة السرعة
            </span>
            <span className="text-slate-400">
              جميع المحتويات تبث مباشرة من خوادم Jellyfin &amp; Emby المحلية داخل الـ LAN بدون استهلاك باقة
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-3 font-mono text-[11px] px-3 py-1.5 rounded-lg border ${
          isLanOnline !== false
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLanOnline !== false ? 'bg-emerald-500 animate-ping' : 'bg-amber-400'}`}></span>
          <span>{isLanOnline !== false ? 'LAN Status: 1000 Mbps Online' : 'وضع الكاش المحلي: Offline Cache'}</span>
        </div>
      </div>

      {/* Trending Now Shelf */}
      <ContentRow
        title={t.trendingNow}
        subtitle="أكثر العناوين مشاهدة بين زوار الاستراحة هذا الأسبوع"
        items={trendingItems}
        currentUser={currentUser}
        t={t}
        onSelect={onSelect}
        onPlay={onPlay}
        icon={<Flame className="w-5 h-5 text-amber-500" />}
      />

      {/* New Releases & Cinema */}
      <ContentRow
        title={t.newReleases}
        subtitle="أحدث إصدارات السينما فائقة الدقة 4K HDR"
        items={newReleases}
        currentUser={currentUser}
        t={t}
        onSelect={onSelect}
        onPlay={onPlay}
        icon={<Sparkles className="w-5 h-5 text-purple-400" />}
      />

      {/* Top Movies */}
      <ContentRow
        title={t.movies}
        subtitle="أفضل الأفلام السينمائية العالمية والعربية"
        items={movies}
        currentUser={currentUser}
        t={t}
        onSelect={onSelect}
        onPlay={onPlay}
        icon={<Film className="w-5 h-5 text-blue-400" />}
      />

      {/* TV Series */}
      {series.length > 0 && (
        <ContentRow
          title={t.series}
          subtitle="المواسم والحلقات الكاملة بجودة أصلية"
          items={series}
          currentUser={currentUser}
          t={t}
          onSelect={onSelect}
          onPlay={onPlay}
          icon={<Tv className="w-5 h-5 text-emerald-400" />}
        />
      )}

      {/* Kids & Family Zone */}
      {kidsItems.length > 0 && (
        <ContentRow
          title={t.kidsAndFamily}
          subtitle="محتوى آمن ومناسب لجميع أفراد العائلة والأطفال"
          items={kidsItems}
          currentUser={currentUser}
          t={t}
          onSelect={onSelect}
          onPlay={onPlay}
          icon={<Baby className="w-5 h-5 text-pink-400" />}
        />
      )}
    </div>
  );
};
