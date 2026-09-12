import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ContentCard } from '../streaming/ContentCard';
import { FilterBar } from '../streaming/FilterBar';
import { Film, Loader2, ArrowDownCircle, ArrowUpCircle, CheckCircle2, SlidersHorizontal } from 'lucide-react';

interface MoviesViewProps {
  mediaItems: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

const PAGE_SIZE = 10;

export const MoviesView: React.FC<MoviesViewProps> = ({
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

  const allMovies = useMemo(() => {
    return mediaItems.filter((i) => i.item_type === 'movie');
  }, [mediaItems]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    allMovies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set);
  }, [allMovies]);

  const filteredMovies = useMemo(() => {
    let result = [...allMovies];

    if (selectedGenre !== 'all') {
      result = result.filter((m) => m.genres.includes(selectedGenre));
    }

    if (selectedResolution !== 'all') {
      result = result.filter((m) => m.resolution.includes(selectedResolution));
    }

    if (selectedSort === 'newest') {
      result.sort((a, b) => b.year - a.year);
    } else if (selectedSort === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      result.sort((a, b) => b.view_count - a.view_count);
    }

    return result;
  }, [allMovies, selectedGenre, selectedResolution, selectedSort]);

  // Reset pagination when filter or sort criteria change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedGenre, selectedResolution, selectedSort]);

  const visibleMovies = useMemo(() => {
    return filteredMovies.slice(0, visibleCount);
  }, [filteredMovies, visibleCount]);

  const hasMore = visibleCount < filteredMovies.length;

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredMovies.length));
      setIsLoadingMore(false);
    }, 280);
  }, [isLoadingMore, hasMore, filteredMovies.length]);

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

  const progressPercentage = filteredMovies.length > 0
    ? Math.round((Math.min(visibleCount, filteredMovies.length) / filteredMovies.length) * 100)
    : 100;

  return (
    <div className="space-y-6 pb-12">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{t.movies}</h2>
            <p className="text-xs text-slate-400">تصفح مكتبة الأفلام السينمائية المتاحة على خوادم الشبكة المحلية</p>
          </div>
        </div>

        {/* Infinite Scroll / Auto-load Control */}
        {filteredMovies.length > PAGE_SIZE && (
          <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            <span className="text-[11px] text-slate-400 font-medium">
              {t.infiniteScroll}:
            </span>
            <button
              onClick={() => setInfiniteScrollEnabled(!infiniteScrollEnabled)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                infiniteScrollEnabled
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
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
        totalCount={filteredMovies.length}
      />

      {/* Movies Grid */}
      {visibleMovies.length > 0 ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {visibleMovies.map((item) => (
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
            {filteredMovies.length > PAGE_SIZE && (
              <div className="w-full max-w-xs space-y-1.5 text-center">
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
                  <span>
                    {t.showingCount} {Math.min(visibleCount, filteredMovies.length)} {t.of} {filteredMovies.length}
                  </span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300 rounded-full"
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
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition-all shadow-lg hover:shadow-blue-500/10 active:scale-95 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>{t.loadingMore}</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownCircle className="w-4 h-4 text-blue-400" />
                      <span>{t.loadMore} (+{Math.min(PAGE_SIZE, filteredMovies.length - visibleCount)})</span>
                    </>
                  )}
                </button>
              </div>
            ) : filteredMovies.length > PAGE_SIZE ? (
              <div className="flex items-center gap-3 py-2 text-xs text-slate-400 font-medium">
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.allLoaded}</span>
                </div>
                <button
                  onClick={scrollToTop}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5 text-blue-400" />
                  <span>العودة للأعلى</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-300">{t.noResultsFound}</h4>
          <p className="text-xs text-slate-500">جرب اختيار تصنيف أو دقة عرض مختلفة</p>
        </div>
      )}
    </div>
  );
};

