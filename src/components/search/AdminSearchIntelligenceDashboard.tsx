import React, { useState, useEffect } from 'react';
import { 
  Search, Sparkles, BarChart3, Sliders, BookOpen, 
  FlaskConical, AlertCircle, RefreshCw, Plus, Trash2, Check,
  TrendingUp, Clock, Target, Layers, ArrowUpRight, Shield
} from 'lucide-react';

interface SynonymItem {
  id: string;
  term: string;
  synonyms: string[];
  language: string;
  is_active: boolean;
}

interface SuggestionItem {
  id: string;
  text: string;
  type: string;
  priority: number;
  icon: string;
}

interface ABTestItem {
  id: string;
  name: string;
  test_type: string;
  status: string;
  traffic_split: number;
  target_metric: string;
  results?: any;
}

export const AdminSearchIntelligenceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'ranking' | 'synonyms' | 'suggestions' | 'ab_tests'>('analytics');
  
  // Analytics State
  const [metrics, setMetrics] = useState({
    total_searches: 18420,
    unique_users: 1240,
    zero_results_count: 84,
    avg_latency_ms: 12.4,
    ctr_percentage: 42.8,
    top_queries: [
      { query_text: 'Avatar', count: 480, ctr: 58.2 },
      { query_text: 'أفلام أكشن 4K', count: 350, ctr: 44.1 },
      { query_text: 'Oppenheimer', count: 310, ctr: 52.0 },
      { query_text: 'Stranger Things', count: 280, ctr: 49.3 },
      { query_text: 'Batman', count: 240, ctr: 41.5 },
    ],
    zero_queries: [
      { query_text: 'the dark knight 3', count: 28, suggested_fix: 'Add synonym to Batman' },
      { query_text: 'مسلسل الحفرة مترجم', count: 22, suggested_fix: 'Check Turkish series library' },
      { query_text: 'Dune 3', count: 18, suggested_fix: 'Unreleased movie' },
      { query_text: 'افلام انمي 2024', count: 15, suggested_fix: 'Add Arabic Anime genre tag' },
    ]
  });

  // Ranking Weights State
  const [weights, setWeights] = useState({
    text_match: 0.35,
    exact_match: 0.15,
    popularity: 0.10,
    recency: 0.10,
    user_affinity: 0.10,
    quality_score: 0.10,
    trending: 0.05,
    external_rating: 0.05,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synonyms State
  const [synonyms, setSynonyms] = useState<SynonymItem[]>([
    { id: '1', term: 'batman', synonyms: ['الرجل الوطواط', 'dark knight', 'bats'], language: 'ar', is_active: true },
    { id: '2', term: 'action', synonyms: ['أكشن', 'قتال', 'حركة', 'إثارة'], language: 'ar', is_active: true },
    { id: '3', term: 'sci-fi', synonyms: ['خيال علمي', 'فضاء', 'مستقبل'], language: 'ar', is_active: true },
    { id: '4', term: 'spiderman', synonyms: ['سبايدرمان', 'الرجل العنكبوت', 'peter parker'], language: 'ar', is_active: true },
  ]);
  const [newTerm, setNewTerm] = useState('');
  const [newSynonymsInput, setNewSynonymsInput] = useState('');
  const [newLanguage, setNewLanguage] = useState('ar');

  // Suggestions State
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([
    { id: '1', text: 'أفضل أفلام 2024 بجودة 4K', type: 'TRENDING', priority: 100, icon: 'Flame' },
    { id: '2', text: 'مسلسلات الجريمة والغموض', type: 'FEATURED', priority: 90, icon: 'Sparkles' },
    { id: '3', text: 'أفلام الرعب والإثارة', type: 'CURATED', priority: 80, icon: 'Skull' },
    { id: '4', text: 'Marvel Cinematic Universe', type: 'COLLECTION', priority: 70, icon: 'Film' },
  ]);
  const [newSugText, setNewSugText] = useState('');
  const [newSugType, setNewSugType] = useState('TRENDING');

  // A/B Tests State
  const [abTests, setAbTests] = useState<ABTestItem[]>([
    {
      id: 'ab-1',
      name: 'User Affinity vs Pure Relevance Ranking',
      test_type: 'RANKING',
      status: 'RUNNING',
      traffic_split: 50,
      target_metric: 'CTR',
      results: { variant_a_ctr: '38.4%', variant_b_ctr: '44.2%', winner: 'B (Personalized Affinity)' }
    },
    {
      id: 'ab-2',
      name: 'Autocomplete Autopredict Depth',
      test_type: 'UI_SUGGESTIONS',
      status: 'COMPLETED',
      traffic_split: 50,
      target_metric: 'ZERO_RESULT_REDUCTION',
      results: { variant_a_zero: '6.2%', variant_b_zero: '3.8%', winner: 'B (8 Suggestions)' }
    }
  ]);

  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);

  const handleWeightChange = (key: keyof typeof weights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveWeights = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleAddSynonym = () => {
    if (!newTerm.trim()) return;
    const synList = newSynonymsInput.split(',').map(s => s.trim()).filter(Boolean);
    const item: SynonymItem = {
      id: Date.now().toString(),
      term: newTerm.trim().toLowerCase(),
      synonyms: synList.length ? synList : [newTerm.trim()],
      language: newLanguage,
      is_active: true
    };
    setSynonyms([item, ...synonyms]);
    setNewTerm('');
    setNewSynonymsInput('');
  };

  const handleDeleteSynonym = (id: string) => {
    setSynonyms(synonyms.filter(s => s.id !== id));
  };

  const handleAddSuggestion = () => {
    if (!newSugText.trim()) return;
    const item: SuggestionItem = {
      id: Date.now().toString(),
      text: newSugText.trim(),
      type: newSugType,
      priority: 100,
      icon: 'Sparkles'
    };
    setSuggestions([item, ...suggestions]);
    setNewSugText('');
  };

  const handleDeleteSuggestion = (id: string) => {
    setSuggestions(suggestions.filter(s => s.id !== id));
  };

  const handleTriggerReindex = () => {
    setIsReindexing(true);
    setReindexDone(false);
    setTimeout(() => {
      setIsReindexing(false);
      setReindexDone(true);
      setTimeout(() => setReindexDone(false), 4000);
    }, 1800);
  };

  const totalWeight: number = (Object.values(weights) as number[]).reduce((a: number, b: number) => a + b, 0);

  return (
    <div className="space-y-6 text-right font-sans select-none">
      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>منصة ذكاء البحث الموحد والتحليلات</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                Phase 16
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              إدارة خوارزميات الترتيب متعدد العوامل، قاموس المرادفات متعدد اللغات، واختبارات A/B
            </p>
          </div>
        </div>

        {/* Action Button: Reindex */}
        <button
          onClick={handleTriggerReindex}
          disabled={isReindexing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isReindexing ? 'animate-spin' : ''}`} />
          <span>{isReindexing ? 'جاري إعادة بناء الفهرس...' : 'إعادة بناء الفهرس الشامل (Reindex)'}</span>
        </button>
      </div>

      {reindexDone && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>تمت إعادة تطبيع النصوص وفهرسة الترايجرام Trigram لكافة خوادم الوسائط بنجاح.</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'analytics', label: 'تحليلات البحث والـ CTR', icon: BarChart3 },
          { id: 'ranking', label: 'أوزان خوارزمية الترتيب', icon: Sliders },
          { id: 'synonyms', label: 'قاموس المرادفات (Synonyms)', icon: BookOpen },
          { id: 'suggestions', label: 'الاقتراحات والتريند', icon: Sparkles },
          { id: 'ab_tests', label: 'اختبارات A/B الذكية', icon: FlaskConical },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Analytics & Zero Results */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-[11px] block">إجمالي عمليات البحث</span>
              <span className="text-xl font-black text-white font-mono">{metrics.total_searches.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-400 block mt-1">+14% هذا الأسبوع</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-[11px] block">المستخدمين الفريدين</span>
              <span className="text-xl font-black text-white font-mono">{metrics.unique_users.toLocaleString()}</span>
              <span className="text-[10px] text-blue-400 block mt-1">عبر كافة شبكات الـ LAN</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-[11px] block">معدل النقر (CTR)</span>
              <span className="text-xl font-black text-amber-400 font-mono">{metrics.ctr_percentage}%</span>
              <span className="text-[10px] text-amber-300/80 block mt-1">تفاعل فائق الكفاءة</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-[11px] block">متوسط زمن الاستجابة</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{metrics.avg_latency_ms} ms</span>
              <span className="text-[10px] text-slate-500 block mt-1">PostgreSQL Trigram FTS</span>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-[11px] block">استعلامات بلا نتائج</span>
              <span className="text-xl font-black text-rose-400 font-mono">{metrics.zero_results_count}</span>
              <span className="text-[10px] text-rose-300/80 block mt-1">0.45% فقط من الإجمالي</span>
            </div>
          </div>

          {/* Tables: Top Queries & Zero Queries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Queries */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>أكثر الكلمات بحثاً وتفاعلاً (Top Queries)</span>
                </h3>
                <span className="text-[11px] text-slate-400">آخر 7 أيام</span>
              </div>
              <div className="space-y-2">
                {metrics.top_queries.map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">{q.query_text}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-slate-400">{q.count} بحث</span>
                      <span className="text-emerald-400 font-bold">{q.ctr}% CTR</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero Results Analysis */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>اكتشاف فجوات المحتوى (Zero-Result Queries)</span>
                </h3>
                <span className="text-[11px] text-rose-400 font-bold">تحتاج مرادفات أو محتوى</span>
              </div>
              <div className="space-y-2">
                {metrics.zero_queries.map((zq, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-300 font-mono">"{zq.query_text}"</span>
                      <span className="text-[11px] text-slate-400 font-mono">{zq.count} محاولة</span>
                    </div>
                    <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>الإجراء المقترح: {zq.suggested_fix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Ranking Weights Configuration */}
      {activeTab === 'ranking' && (
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">تخصيص أوزان الترتيب متعدد العوامل (Multi-Factor Scoring)</h3>
              <p className="text-xs text-slate-400">
                يحدد المحرك النقاط الموزونة لكل عمل قبل عرضه في نتائج البحث الموحد
              </p>
            </div>
            <div className="text-left font-mono text-xs">
              <span className="text-slate-400">مجموع الأوزان: </span>
              <span className={`font-bold ${Math.abs(totalWeight - 1.0) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {totalWeight.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { key: 'text_match', label: 'تطابق النص الشامل (Full-Text & Trigram)', desc: 'مدى تشابه العنوان والوصف مع الكلمات المكتوبة' },
              { key: 'exact_match', label: 'مكافأة التطابق التام (Exact Match Boost)', desc: 'مضاعفة النتيجة إذا كان الاسم متطابقاً بحذافيره' },
              { key: 'popularity', label: 'شعبية العمل (Global Popularity)', desc: 'عدد مرات المشاهدة والتقييمات الإجمالية' },
              { key: 'recency', label: 'حداثة الإضافة (Recency Decay)', desc: 'منح الأفضلية للمحتوى المضاف خلال آخر 30 يوماً' },
              { key: 'user_affinity', label: 'التخصيص الشخصي (User Genre Affinity)', desc: 'ملاءمة العمل لتاريخ مشاهدات المستخدم الحالي' },
              { key: 'quality_score', label: 'جودة البيانات والبوسترات (Data Quality)', desc: 'اكتمال الميتاداتا والترجمات العربية والجودة العالية' },
              { key: 'trending', label: 'الرواج الحالي (Trending Score)', desc: 'المحتوى الأكثر طلباً خلال الساعات الماضية' },
              { key: 'external_rating', label: 'تقييم IMDb و TMDB العالمي', desc: 'تفضيل الأعمال الحائزة على تقييمات نقدية مرتفعة' },
            ].map((item) => {
              const val = weights[item.key as keyof typeof weights];
              return (
                <div key={item.key} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.label}</span>
                    <span className="text-xs font-mono text-amber-400 font-bold">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                  <input
                    type="range"
                    min="0"
                    max="0.60"
                    step="0.01"
                    value={val}
                    onChange={(e) => handleWeightChange(item.key as keyof typeof weights, parseFloat(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setWeights({
                text_match: 0.35,
                exact_match: 0.15,
                popularity: 0.10,
                recency: 0.10,
                user_affinity: 0.10,
                quality_score: 0.10,
                trending: 0.05,
                external_rating: 0.05,
              })}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
            >
              استعادة القيم الافتراضية
            </button>

            <button
              onClick={handleSaveWeights}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20"
            >
              {saveSuccess ? '✓ تم حفظ وتحديث الأوزان فوراً' : 'حفظ ونشر أوزان الخوارزمية'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Multilingual Synonyms Dictionary */}
      {activeTab === 'synonyms' && (
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">قاموس المرادفات الذكي (Synonym Expansion)</h3>
              <p className="text-xs text-slate-400">
                يربط المصطلحات باللغتين العربية والإنجليزية لضمان العثور على العمل مهما كانت صياغة المستخدم
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-800 rounded-xl text-xs font-mono text-amber-400 font-bold">
              {synonyms.length} مصطلحات مفهرسة
            </span>
          </div>

          {/* Add Synonym Form */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-[11px] text-slate-400 font-bold block mb-1">المصطلح الأساسي:</label>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="e.g. matrix"
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-hidden focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400 font-bold block mb-1">المرادفات البديلة (مفصولة بفواصل):</label>
              <input
                type="text"
                value={newSynonymsInput}
                onChange={(e) => setNewSynonymsInput(e.target.value)}
                placeholder="ماتريكس, المصفوفة, neo, the matrix"
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-hidden focus:border-amber-500"
              />
            </div>
            <button
              onClick={handleAddSynonym}
              className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرادف</span>
            </button>
          </div>

          {/* Synonyms List */}
          <div className="space-y-3">
            {synonyms.map((s) => (
              <div key={s.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {s.term}
                    </span>
                    <span className="text-[11px] text-slate-400">يتطابق مع:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {s.synonyms.map((syn, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSynonym(s.id)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-colors"
                  title="حذف المرادف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Suggestions & Trending Management */}
      {activeTab === 'suggestions' && (
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">إدارة اقتراحات الإكمال التلقائي والشريط الرائج</h3>
              <p className="text-xs text-slate-400">
                تظهر هذه العبارات تلقائياً للمستخدمين أسفل شريط البحث لتوجيههم نحو الأعمال المميزة
              </p>
            </div>
          </div>

          {/* Add Suggestion */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-[11px] text-slate-400 font-bold block mb-1">نص الاقتراح:</label>
              <input
                type="text"
                value={newSugText}
                onChange={(e) => setNewSugText(e.target.value)}
                placeholder="e.g. مسلسلات HBO الحائزة على جوائز"
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-hidden focus:border-amber-500"
              />
            </div>
            <div className="w-40">
              <label className="text-[11px] text-slate-400 font-bold block mb-1">النوع:</label>
              <select
                value={newSugType}
                onChange={(e) => setNewSugType(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white outline-hidden cursor-pointer"
              >
                <option value="TRENDING">Trending (رائج)</option>
                <option value="FEATURED">Featured (مميز)</option>
                <option value="CURATED">Curated (مختار)</option>
                <option value="COLLECTION">Collection (مجموعة)</option>
              </select>
            </div>
            <button
              onClick={handleAddSuggestion}
              className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة اقتراح</span>
            </button>
          </div>

          {/* Suggestions List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map((sug) => (
              <div key={sug.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">{sug.text}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{sug.type} • Priority: {sug.priority}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSuggestion(sug.id)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: A/B Testing */}
      {activeTab === 'ab_tests' && (
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">منصة تجارب واختبارات A/B لمحركات البحث</h3>
              <p className="text-xs text-slate-400">
                قياس تأثير التغييرات في خوارزميات الترتيب وواجهات الاقتراحات على معدل النقر وسرعة الوصول
              </p>
            </div>
            <button className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl hover:bg-amber-400 transition-all flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>إنشاء اختبار جديد</span>
            </button>
          </div>

          <div className="space-y-4">
            {abTests.map((test) => (
              <div key={test.id} className="p-5 bg-slate-950 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{test.name}</h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
                        test.status === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {test.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Target Metric: {test.target_metric} • Split: {test.traffic_split}% / {100 - test.traffic_split}%
                    </span>
                  </div>

                  {test.results?.winner && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>الخيار الفائز: {test.results.winner}</span>
                    </div>
                  )}
                </div>

                {test.results && (
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Variant A (Control)</span>
                      <span className="text-white font-bold text-sm">
                        {test.results.variant_a_ctr || test.results.variant_a_zero}
                      </span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-amber-400 block text-[10px]">Variant B (Experiment)</span>
                      <span className="text-amber-300 font-bold text-sm">
                        {test.results.variant_b_ctr || test.results.variant_b_zero}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
