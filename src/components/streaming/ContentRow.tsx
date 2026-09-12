import React, { useRef } from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ContentCard } from './ContentCard';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

interface ContentRowProps {
  title: string;
  items: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  icon?: React.ReactNode;
  subtitle?: string;
}

export const ContentRow: React.FC<ContentRowProps> = ({
  title,
  items,
  currentUser,
  t,
  onSelect,
  onPlay,
  icon,
  subtitle
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.75;
      rowRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 relative group/row py-2">
      {/* Row Header */}
      <div className="flex items-baseline justify-between px-1 sm:px-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-amber-400">{icon}</span>}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 -mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          {items.length} {t.resultsCount.replace('مطابقة', '')}
        </span>
      </div>

      {/* Relative Carousel Wrapper */}
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-10 h-24 bg-black/60 hover:bg-black/90 text-white rounded-r-xl opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs border-y border-r border-slate-700/60"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={rowRef}
          className="flex items-stretch gap-4 overflow-x-auto overflow-y-hidden scrollbar-none py-2 px-1 sm:px-2 scroll-smooth"
        >
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              currentUser={currentUser}
              t={t}
              onSelect={onSelect}
              onPlay={onPlay}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-10 h-24 bg-black/60 hover:bg-black/90 text-white rounded-l-xl opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs border-y border-l border-slate-700/60"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
