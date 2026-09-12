import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ContentCard } from '../streaming/ContentCard';
import { SmartLoungeApiClient } from '../../lib/apiClient';
import { 
  Search, X, Sparkles, Filter, SlidersHorizontal, Server, Tag, Film, Tv, 
  Crown, Clock, Bookmark, BookmarkCheck, Trash2, ArrowUpRight, Flame,
  Check, Star, Sliders, ChevronDown, Bell
} from 'lucide-react';

interface UnifiedSearchViewProps {
  mediaItems: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

const TRENDING_SUGGESTIONS = [
  '4K UHD',
  'أفلام أكشن',
  'خيال علمي 2024',
  'مسلسلات جريمة وغموض',
  'دراما تاريخية',
  'أنيميشن عائلي',
  'أعلى تقييم ★ 8+',
  'VIP Exclusive'
];

interface NLInterpretation {
  intent: string;
  entities: {
    year?: number;
    quality?: string;
    genres?: string[];
    item_type?: string;
  };
  cleaned_query: string;
}

export const UnifiedSearchView: React.FC<UnifiedSearchViewProps> = ({
  mediaItems,
  currentUser,
  t,
  onSelect,
  onPlay
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedResolution, setSelectedResolution] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedDecade, setSelectedDecade] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<MediaItem[]>(mediaItems);
  
  // Autocomplete & Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search History State (Local storage synced)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`sl_search_history_${currentUser.id}`);
      return saved ? JSON.parse(saved) : ['Avatar 4K', 'Inception', 'أفلام أكشن 2023'];
    } catch {
      return ['Avatar 4K', 'Inception', 'أفلام أكشن 2023'];
    }
  });

  // Saved Searches State
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; query: string; notify: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem(`sl_saved_searches_${currentUser.id}`);
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'أفلام 4K الجديدة', query: '4K', notify: true },
        { id: '2', name: 'مسلسلات خيال علمي', query: 'خيال علمي', notify: false }
      ];
    } catch {
      return [{ id: '1', name: 'أفلام 4K الجديدة', query: '4K', notify: true }];
    }
  });
  const [isCurrentSearchSaved, setIsCurrentSearchSaved] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveNotifyWeekly, setSaveNotifyWeekly] = useState(true);

  // Natural Language Search Mode
  const [isNLEnabled, setIsNLEnabled] = useState(false);
  const [nlInterpretation, setNlInterpretation] = useState<NLInterpretation | null>(null);

  // Extract all available genres for filtering
  const allAvailableGenres = useMemo(() => {
    const set = new Set<string>();
    mediaItems.forEach(item => {
      item.genres?.forEach(g => set.add(g));
    });
    return Array.from(set).sort();
  }, [mediaItems]);

  // Normalize Arabic text helper
  const normalizeArabic = (text: string) => {
    return text
      .replace(/[\u064B-\u0652]/g, '') // remove tashkeel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/[يى]/g, 'ي')
      .trim()
      .toLowerCase();
  };

  // Autocomplete Suggestions computation
  const autocompleteSuggestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return {
        history: searchHistory.slice(0, 4),
        trending: TRENDING_SUGGESTIONS.slice(0, 4),
        items: []
      };
    }

    const q = searchQuery.toLowerCase().trim();
    const normQ = normalizeArabic(searchQuery);

    const matchedItems = mediaItems.filter(item => {
      const normT = normalizeArabic(item.title);
      const orig = (item.original_title || '').toLowerCase();
      return normT.includes(normQ) || orig.includes(q);
    }).slice(0, 4);

    const matchedHistory = searchHistory.filter(h => 
      normalizeArabic(h).includes(normQ)
    );

    const matchedTrending = TRENDING_SUGGESTIONS.filter(t => 
      normalizeArabic(t).includes(normQ)
    );

    return {
      history: matchedHistory,
      trending: matchedTrending,
      items: matchedItems
    };
  }, [searchQuery, searchHistory, mediaItems]);

  // Check if current search is already bookmarked
  useEffect(() => {
    if (!searchQuery.trim()) {
      setIsCurrentSearchSaved(false);
      return;
    }
    const found = savedSearches.some(s => s.query.toLowerCase() === searchQuery.trim().toLowerCase());
    setIsCurrentSearchSaved(found);
  }, [searchQuery, savedSearches]);

  // Save history to localStorage
  const recordHistory = (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;
    const updated = [q, ...searchHistory.filter(h => h.toLowerCase() !== q.toLowerCase())].slice(0, 20);
    setSearchHistory(updated);
    try {
      localStorage.setItem(`sl_search_history_${currentUser.id}`, JSON.stringify(updated));
    } catch {}
  };

  const removeHistoryItem = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    const updated = searchHistory.filter(h => h !== itemToRemove);
    setSearchHistory(updated);
    try {
      localStorage.setItem(`sl_search_history_${currentUser.id}`, JSON.stringify(updated));
    } catch {}
  };

  const clearAllHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(`sl_search_history_${currentUser.id}`);
    } catch {}
  };

  // Perform Search Execution
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      // Natural Language parsing emulation for enhanced query response
      let effectiveQuery = searchQuery;
      let effectiveType = selectedType;
      let effectiveResolution = selectedResolution;
      let effectiveYear: number | undefined = undefined;
      let parsedNL: NLInterpretation | null = null;

      if (isNLEnabled && searchQuery.trim()) {
        const qLower = searchQuery.toLowerCase();
        const entities: NLInterpretation['entities'] = {};
        
        // Match year
        const yearMatch = qLower.match(/\b(19\d{2}|20\d{2})\b/);
        if (yearMatch) {
          entities.year = parseInt(yearMatch[1]);
          effectiveYear = entities.year;
        }

        // Match 4K / Quality
        if (qLower.includes('4k') || qLower.includes('uhd')) {
          entities.quality = '4K';
          effectiveResolution = '4K';
        } else if (qLower.includes('1080p') || qLower.includes('fhd')) {
          entities.quality = '1080p';
          effectiveResolution = '1080p';
        }

        // Match type
        if (qLower.includes('فيلم') || qLower.includes('افلام') || qLower.includes('movie')) {
          entities.item_type = 'movie';
          effectiveType = 'movie';
        } else if (qLower.includes('مسلسل') || qLower.includes('مسلسلات') || qLower.includes('series')) {
          entities.item_type = 'series';
          effectiveType = 'series';
        }

        // Match genres
        const detectedGenres: string[] = [];
        if (qLower.includes('أكشن') || qLower.includes('اكشن') || qLower.includes('action')) detectedGenres.push('أكشن');
        if (qLower.includes('كوميديا') || qLower.includes('comedy')) detectedGenres.push('كوميديا');
        if (qLower.includes('دراما') || qLower.includes('drama')) detectedGenres.push('دراما');
        if (qLower.includes('خيال علمي') || qLower.includes('sci-fi')) detectedGenres.push('خيال علمي');
        if (detectedGenres.length > 0) {
          entities.genres = detectedGenres;
        }

        // Cleaned core title keywords
        const cleaned = searchQuery
          .replace(/\b(أريد|ابحث عن|فيلم|أفلام|افلام|مسلسل|مسلسلات|بجودة|سنة|عام|movie|series|watch|find)\b/gi, '')
          .replace(/\b(19\d{2}|20\d{2})\b/g, '')
          .replace(/\b(4k|1080p|uhd|fhd)\b/gi, '')
          .trim();

        parsedNL = {
          intent: entities.year || entities.genres ? 'DISCOVERY' : 'SPECIFIC',
          entities,
          cleaned_query: cleaned || searchQuery
        };
        effectiveQuery = cleaned || searchQuery;
      }

      setNlInterpretation(parsedNL);

      const resp = await SmartLoungeApiClient.searchCatalog(
        {
          query: effectiveQuery,
          type: effectiveType,
          resolution: effectiveResolution,
          year: effectiveYear,
        },
        mediaItems
      );

      if (!isCancelled) {
        let res = resp.results;

        // Apply Genre Filter
        if (selectedGenre !== 'all') {
          res = res.filter(item => item.genres?.includes(selectedGenre));
        }

        // Apply Rating Threshold
        if (minRating > 0) {
          res = res.filter(item => (item.rating || 0) >= minRating);
        }

        // Apply Decade Filter
        if (selectedDecade !== 'all') {
          const startYear = parseInt(selectedDecade);
          res = res.filter(item => item.year >= startYear && item.year < startYear + 10);
        }

        // Arabic normalization client-side check
        if (effectiveQuery.trim()) {
          const normQ = normalizeArabic(effectiveQuery);
          res = res.filter((item) => {
            const normTitle = normalizeArabic(item.title);
            const orig = (item.original_title || '').toLowerCase();
            const normOverview = normalizeArabic(item.overview);
            const normGenres = item.genres.map(g => normalizeArabic(g));

            return (
              normTitle.includes(normQ) ||
              orig.includes(effectiveQuery.toLowerCase()) ||
              normOverview.includes(normQ) ||
              normGenres.some(g => g.includes(normQ))
            );
          });
        }

        setSearchResults(res);
        setIsLoading(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    searchQuery, selectedType, selectedResolution, selectedGenre, 
    minRating, selectedDecade, isNLEnabled, mediaItems
  ]);

  const handleExecuteSearch = (text: string) => {
    setSearchQuery(text);
    setIsDropdownOpen(false);
    recordHistory(text);
  };

  const handleSaveCurrentSearch = () => {
    if (!searchQuery.trim()) return;
    const newSaved = {
      id: Date.now().toString(),
      name: saveSearchName.trim() || searchQuery.trim(),
      query: searchQuery.trim(),
      notify: saveNotifyWeekly
    };
    const updated = [newSaved, ...savedSearches];
    setSavedSearches(updated);
    setIsCurrentSearchSaved(true);
    setShowSavedModal(false);
    setSaveSearchName('');
    try {
      localStorage.setItem(`sl_saved_searches_${currentUser.id}`, JSON.stringify(updated));
    } catch {}
  };

  const handleDeleteSavedSearch = (id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    try {
      localStorage.setItem(`sl_saved_searches_${currentUser.id}`, JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="space-y-6 pb-12 select-none">
      {/* Search Header & Input Box */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>{t.search}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                  AI &amp; Multi-Factor Ranking
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                بحث موحد ذكي فائق السرعة عبر جميع خوادم الوسائط (Jellyfin &amp; Emby) داخل الـ LAN
              </p>
            </div>
          </div>

          {/* Natural Language Toggle & Saved Searches Trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNLEnabled(!isNLEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isNLEnabled
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md shadow-purple-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="تفعيل استخراج الكيانات والبحث باللغة الطبيعية"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>بحث ذكي (AI Natural Language)</span>
            </button>

            {searchQuery.trim() && (
              <button
                onClick={() => setShowSavedModal(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  isCurrentSearchSaved
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
                title="حفظ البحث وتلقي تنبيهات عند نزول أعمال جديدة"
              >
                {isCurrentSearchSaved ? (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>محفوظ</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>حفظ البحث</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Input Bar with Instant Autocomplete Dropdown */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleExecuteSearch(searchQuery);
              } else if (e.key === 'Escape') {
                setIsDropdownOpen(false);
              }
            }}
            placeholder={
              isNLEnabled
                ? 'اكتب مثلاً: "أريد فيلم أكشن 2023 بجودة 4K" أو "similar to Inception"...'
                : t.searchPlaceholder
            }
            className="w-full h-14 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-2xl pr-12 pl-12 text-sm text-white placeholder-slate-500 outline-hidden transition-all shadow-inner"
            autoFocus
          />

          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(false);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute top-full right-0 left-0 mt-2 z-40 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-800 animate-fadeIn">
                {/* Matched Content Items (Instant Preview) */}
                {autocompleteSuggestions.items.length > 0 && (
                  <div className="p-2 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold px-3 py-1 block">أعمال مقترحة فورية:</span>
                    {autocompleteSuggestions.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onSelect(item);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.poster_url}
                            alt={item.title}
                            className="w-8 h-11 object-cover rounded-md bg-slate-800 shrink-0"
                          />
                          <div className="text-right">
                            <span className="text-xs font-bold text-white block">{item.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.year} • {item.resolution} • ★ {item.rating}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                          {item.item_type === 'movie' ? 'فيلم' : 'مسلسل'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search History Matches */}
                {autocompleteSuggestions.history.length > 0 && (
                  <div className="p-2 space-y-1">
                    <div className="flex items-center justify-between px-3 py-1">
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>عمليات البحث السابقة</span>
                      </span>
                      <button 
                        onClick={clearAllHistory}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        مسح السجل
                      </button>
                    </div>
                    {autocompleteSuggestions.history.map((hist, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleExecuteSearch(hist)}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors text-xs text-slate-300 group"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{hist}</span>
                        </div>
                        <button
                          onClick={(e) => removeHistoryItem(e, hist)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trending Suggestions */}
                {autocompleteSuggestions.trending.length > 0 && (
                  <div className="p-2 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold px-3 py-1 block flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-400" />
                      <span>الأكثر رواجاً في الاستراحة:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 p-2">
                      {autocompleteSuggestions.trending.map((trend, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleExecuteSearch(trend)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold border border-slate-800 transition-all flex items-center gap-1"
                        >
                          <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-slate-950" />
                          <span>{trend}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Natural Language Extracted Entities Breakdown Banner */}
        {isNLEnabled && nlInterpretation && (
          <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
            <div className="flex items-center gap-2 text-purple-200">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-bold">تحليل الذكاء الاصطناعي للاستعلام:</span>
              <span className="text-slate-300">النية ({nlInterpretation.intent})</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {nlInterpretation.entities.item_type && (
                <span className="px-2 py-0.5 rounded-md bg-purple-900 text-purple-200 font-bold text-[11px]">
                  النوع: {nlInterpretation.entities.item_type}
                </span>
              )}
              {nlInterpretation.entities.year && (
                <span className="px-2 py-0.5 rounded-md bg-purple-900 text-purple-200 font-bold text-[11px]">
                  السنة: {nlInterpretation.entities.year}
                </span>
              )}
              {nlInterpretation.entities.quality && (
                <span className="px-2 py-0.5 rounded-md bg-purple-900 text-purple-200 font-bold text-[11px]">
                  الدقة: {nlInterpretation.entities.quality}
                </span>
              )}
              {nlInterpretation.entities.genres?.map((g, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-purple-900 text-purple-200 font-bold text-[11px]">
                  تصنيف: {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-semibold">{t.searchSuggestions}:</span>
          {TRENDING_SUGGESTIONS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleExecuteSearch(chip)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold transition-all border border-slate-700/60"
            >
              #{chip}
            </button>
          ))}
        </div>

        {/* Primary Filter Row & Advanced Filters Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedType === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setSelectedType('movie')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedType === 'movie' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.movies}
              </button>
              <button
                onClick={() => setSelectedType('series')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  selectedType === 'series' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.series}
              </button>
            </div>

            {/* Resolution Filter */}
            <select
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value)}
              className="bg-slate-950 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-800 outline-hidden font-medium cursor-pointer"
            >
              <option value="all">{t.allResolutions}</option>
              <option value="4K">4K UHD</option>
              <option value="1080p">1080p FHD</option>
            </select>

            {/* Advanced Filters Toggle Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                showAdvancedFilters || selectedGenre !== 'all' || minRating > 0 || selectedDecade !== 'all'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>فلاتر متقدمة</span>
              {(selectedGenre !== 'all' || minRating > 0 || selectedDecade !== 'all') && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-slate-400">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-amber-400">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                جاري البحث والترتيب...
              </span>
            ) : (
              <span>{searchResults.length} {t.resultsCount}</span>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Faceted Filters */}
        {showAdvancedFilters && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-fadeIn">
            {/* Genre Filter */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">التصنيف النوعي (Genre):</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 p-2 rounded-xl border border-slate-700 outline-hidden cursor-pointer"
              >
                <option value="all">جميع التصنيفات</option>
                {allAvailableGenres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Rating Filter */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">الحد الأدنى للتقييم:</label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
                className="w-full bg-slate-900 text-slate-200 p-2 rounded-xl border border-slate-700 outline-hidden cursor-pointer"
              >
                <option value="0">الكل (أي تقييم)</option>
                <option value="7">★ 7.0 فأعلى (ممتاز)</option>
                <option value="8">★ 8.0 فأعلى (شاهكار)</option>
                <option value="8.5">★ 8.5 فأعلى (Top Tier)</option>
              </select>
            </div>

            {/* Decade Filter */}
            <div className="space-y-1">
              <label className="text-slate-400 font-bold block">فترة الإنتاج:</label>
              <select
                value={selectedDecade}
                onChange={(e) => setSelectedDecade(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 p-2 rounded-xl border border-slate-700 outline-hidden cursor-pointer"
              >
                <option value="all">كافة السنوات</option>
                <option value="2020">أحدث الإنتاجات (2020 - 2029)</option>
                <option value="2010">أعمال العقد الماضي (2010 - 2019)</option>
                <option value="2000">أوائل الألفية (2000 - 2009)</option>
                <option value="1990">الأعمال الكلاسيكية (1990 - 1999)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Saved Searches Drawer / Bar if exists */}
      {savedSearches.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>عمليات البحث المحفوظة:</span>
          </span>
          {savedSearches.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white shrink-0 transition-colors"
            >
              <button 
                onClick={() => handleExecuteSearch(s.query)}
                className="font-bold flex items-center gap-1"
              >
                <span>{s.name}</span>
                {s.notify && <Bell className="w-2.5 h-2.5 text-amber-400" />}
              </button>
              <button
                onClick={() => handleDeleteSavedSearch(s.id)}
                className="text-slate-500 hover:text-rose-400 p-0.5"
                title="حذف البحث المحفوظ"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results Grid */}
      {searchResults.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {searchResults.map((item) => (
            <div key={item.id} className="flex justify-center relative group">
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
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center text-slate-400 space-y-3">
          <Search className="w-12 h-12 text-slate-600 mx-auto" />
          <h4 className="text-base font-bold text-slate-200">{t.noResultsFound}</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            تأكد من كتابة الكلمة بشكل صحيح، أو ابحث باسم ممثل، مخرج، أو استخدم البحث باللغة الطبيعية (AI).
          </p>
        </div>
      )}

      {/* Save Search Modal */}
      {showSavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-right space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <span>حفظ استعلام البحث</span>
              </h3>
              <button
                onClick={() => setShowSavedModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">اسم البحث المحفوظ:</label>
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder={searchQuery || 'بحث مخصص'}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white outline-hidden focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">الاستعلام:</label>
                <div className="p-2.5 bg-slate-950 rounded-xl font-mono text-amber-400 border border-slate-800">
                  {searchQuery}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="notifyWeekly"
                  checked={saveNotifyWeekly}
                  onChange={(e) => setSaveNotifyWeekly(e.target.checked)}
                  className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                />
                <label htmlFor="notifyWeekly" className="text-slate-300 font-medium cursor-pointer">
                  تنبيهي دورياً عند توفر أفلام أو مسلسلات جديدة تطابق هذا البحث
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowSavedModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCurrentSearch}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20"
              >
                تأكيد وحفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
