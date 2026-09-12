import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ContentCard } from '../streaming/ContentCard';
import { FilterBar } from '../streaming/FilterBar';
import { Tv, Loader2, ArrowDownCircle, ArrowUpCircle, CheckCircle2 } from 'lucide-react';

interface SeriesViewProps {
  mediaItems: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

const PAGE_SIZE = 10;

export const SeriesView: React.FC<SeriesViewProps> = ({
  mediaItems,
  currentUser,
  t,
  onSelect,
  onPlay
}) => {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedResolution, setSelectedResolution] = useState('all');
  const [selectedSort, setSelectedSort] = useState<'newest' | 'rating' | 'popular'>('popular');

  // Pagination & Infinite Scroll states
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState<boolean>(true);
  const observerSentinelRef = useRef<HTMLDivElement | null>(null);

  const allSeries = useMemo(() => {
    return mediaItems.filter((i) => i.item_type === 'series');
  }, [mediaItems]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    allSeries.forEach((s) => s.genres.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [allSeries]);

  const filteredSeries = useMemo(() => {
    let result = [...allSeries];

    if (selectedGenre !== 'all') {
      result = result.filter((s) => s.genres.includes(selectedGenre));
    }

    if (selectedResolution !== 'all') {
      result = result.filter((s) => s.resolution.includes(selectedResolution));
    }

    if (selectedSort === 'newest') {
      result.sort((a, b) => b.year - a.year);
    } else if (selectedSort === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      result.sort((a, b) => b.view_count - a.view_count);
    }

    return result;
  }, [allSeries, selectedGenre, selectedResolution, selectedSort]);

  // Reset pagination when filter or sort criteria change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedGenre, selectedResolution, selectedSort]);

  const visibleSeries = useMemo(() => {
    return filteredSeries.slice(0, visibleCount);
  }, [filteredSeries, visibleCount]);

  const hasMore = visibleCount < filteredSeries.length;

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSeries.length));
      setIsLoadingMore(false);
    }, 280);
  }, [isLoadingMore, hasMore, filteredSeries.length]);

  // Infinite Scroll with IntersectionObserver
  useEffect(() => {
    if (!infiniteScrollEnabled || !hasMore || isLoadingMore) return;

    const currentSentinel = observerSentinelRef.current;
    if (!currentSentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '160px' }
    );

    observer.observe(currentSentinel);

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [infiniteScrollEnabled, hasMore, isLoadingMore, handleLoadMore]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progressPercentage = filteredSeries.length > 0
    ? Math.round((Math.min(visibleCount, filteredSeries.length) / filteredSeries.length) * 100)
    : 100;

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{t.series}</h2>
            <p className="text-xs text-slate-400">مواسم وحلقات كاملة مع ترجمة ودبلجة احترافية</p>
          </div>
        </div>

        {/* Infinite Scroll / Auto-load Control */}
        {filteredSeries.length > PAGE_SIZE && (
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            <span className="text-[11px] text-slate-400 font-medium">
              {t.infiniteScroll}:
            </span>
            <button
              onClick={() => setInfiniteScrollEnabled(!infiniteScrollEnabled)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                infiniteScrollEnabled
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {infiniteScrollEnabled ? 'تلقائي (Active)' : 'يدوي (Manual)'}
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        genres={availableGenres}
        selectedGenre={selectedGenre}
        onSelectGenre={setSelectedGenre}
        selectedResolution={selectedResolution}
        onSelectResolution={setSelectedResolution}
        selectedSort={selectedSort}
        onSelectSort={setSelectedSort}
        t={t}
        totalCount={filteredSeries.length}
      />

      {/* Series Grid */}
      {visibleSeries.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {visibleSeries.map((item) => (
              <div key={item.id} className="flex justify-center">
                <ContentCard
                  item={item}
                  currentUser={currentUser}
                  t={t}
                  onSelect={onSelect}
                  onPlay={onPlay}
                />
              </div>
            ))}
          </div>

          {/* Load More & Infinite Scroll Section */}
          <div className="pt-4 flex flex-col items-center justify-center space-y-4">
            {/* Progress indicator */}
            {filteredSeries.length > PAGE_SIZE && (
              <div className="w-full max-w-xs space-y-1.5 text-center">
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>
                    {t.showingCount} {Math.min(visibleCount, filteredSeries.length)} {t.of} {filteredSeries.length}
                  </span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Has More: Sentinel & Buttons */}
            {hasMore ? (
              <div className="flex flex-col items-center gap-3 w-full">
                {/* Intersection Observer Sentinel */}
                <div ref={observerSentinelRef} className="h-2 w-full" />

                {/* Manual Load More Button */}
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition-all shadow-lg hover:shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>{t.loadingMore}</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                      <span>{t.loadMore} (+{Math.min(PAGE_SIZE, filteredSeries.length - visibleCount)})</span>
                    </>
                  )}
                </button>
              </div>
            ) : filteredSeries.length > PAGE_SIZE ? (
              <div className="flex items-center gap-3 py-2 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.allLoaded}</span>
                </div>
                <button
                  onClick={scrollToTop}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>العودة للأعلى</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <Tv className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-300">{t.noResultsFound}</h4>
          <p className="text-xs text-slate-500">لا توجد مسلسلات مطابقة للفلاتر المحددة</p>
        </div>
      )}
    </div>
  );
};
