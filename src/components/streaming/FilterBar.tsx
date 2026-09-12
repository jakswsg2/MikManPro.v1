import React from 'react';
import { Translations } from '../../lib/i18n';
import { Filter, Sparkles, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface FilterBarProps {
  genres: string[];
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
  selectedResolution: string;
  onSelectResolution: (res: string) => void;
  selectedSort: 'newest' | 'rating' | 'popular';
  onSelectSort: (sort: 'newest' | 'rating' | 'popular') => void;
  t: Translations;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  genres,
  selectedGenre,
  onSelectGenre,
  selectedResolution,
  onSelectResolution,
  selectedSort,
  onSelectSort,
  t,
  totalCount
}) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 mb-6 text-xs text-slate-300">
      {/* Genre Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => onSelectGenre('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            selectedGenre === 'all'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {t.allGenres}
        </button>

        {genres.map((g) => (
          <button
            key={g}
            onClick={() => onSelectGenre(g)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              selectedGenre === g
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Resolution & Sort Controls */}
      <div className="flex items-center gap-3">
        {/* Quality Selector */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedResolution}
            onChange={(e) => onSelectResolution(e.target.value)}
            className="bg-transparent text-slate-200 outline-hidden font-medium cursor-pointer"
          >
            <option value="all" className="bg-slate-900">{t.allResolutions}</option>
            <option value="4K" className="bg-slate-900">4K UHD</option>
            <option value="1080p" className="bg-slate-900">1080p FHD</option>
            <option value="720p" className="bg-slate-900">720p HD</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/60">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedSort}
            onChange={(e) => onSelectSort(e.target.value as any)}
            className="bg-transparent text-slate-200 outline-hidden font-medium cursor-pointer"
          >
            <option value="popular" className="bg-slate-900">{t.mostPopular}</option>
            <option value="rating" className="bg-slate-900">{t.highestRated}</option>
            <option value="newest" className="bg-slate-900">{t.newest}</option>
          </select>
        </div>

        <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
          {totalCount} {t.resultsCount}
        </span>
      </div>
    </div>
  );
};
