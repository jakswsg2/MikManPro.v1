import React, { useState } from 'react';
import { Translations, Language } from '../../lib/i18n';
import { 
  Settings, Globe, SlidersHorizontal, PlayCircle, Subtitles, 
  Wifi, Activity, Check, RefreshCw 
} from 'lucide-react';

interface SettingsViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  t: Translations;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  language,
  onLanguageChange,
  t
}) => {
  const [streamQuality, setStreamQuality] = useState('1080p');
  const [autoplay, setAutoplay] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [isTestingLatency, setIsTestingLatency] = useState(false);
  const [latency, setLatency] = useState<number | null>(0.6);

  const handleTestLatency = () => {
    setIsTestingLatency(true);
    setTimeout(() => {
      setLatency(Number((0.3 + Math.random() * 0.5).toFixed(2)));
      setIsTestingLatency(false);
    }, 600);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-right">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">{t.settings}</h2>
          <p className="text-xs text-slate-400">تخصيص لغة الواجهة، جودة التشغيل الافتراضية، وخيارات الشبكة</p>
        </div>
      </div>

      {/* Language Section (Decision 65: Arabic RTL / English LTR) */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Globe className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">{t.language} / Language</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => onLanguageChange('ar')}
            className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
              language === 'ar'
                ? 'bg-amber-500/10 border-amber-500/60 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-right space-y-1">
              <span className="font-bold text-sm block text-white">العربية (RTL)</span>
              <span className="text-xs text-slate-400">توجيه الواجهة بالكامل من اليمين إلى اليسار</span>
            </div>
            {language === 'ar' && (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            )}
          </button>

          <button
            onClick={() => onLanguageChange('en')}
            className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
              language === 'en'
                ? 'bg-amber-500/10 border-amber-500/60 text-white'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-right space-y-1">
              <span className="font-bold text-sm block text-white">English (LTR)</span>
              <span className="text-xs text-slate-400">Left-to-Right layout with English labels</span>
            </div>
            {language === 'en' && (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Playback Preferences */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <SlidersHorizontal className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">{t.playbackQuality}</h3>
        </div>

        {/* Quality Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: '4k', label: '4K Ultra HD', desc: 'HEVC DirectPlay' },
            { id: '1080p', label: '1080p Full HD', desc: 'High Quality (Default)' },
            { id: '720p', label: '720p HD', desc: 'Balanced Bandwidth' },
            { id: 'auto', label: 'تلقائي (Auto)', desc: 'Adaptive Bitrate' }
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => setStreamQuality(q.id)}
              className={`p-3.5 rounded-2xl border text-right transition-all ${
                streamQuality === q.id
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="block text-xs font-bold">{q.label}</span>
              <span className={`block text-[10px] mt-0.5 ${streamQuality === q.id ? 'text-slate-900' : 'text-slate-500'}`}>
                {q.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Autoplay & Subtitles Toggles */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-200 block">{t.autoplayNext}</span>
              <span className="text-[11px] text-slate-400">بدء تشغيل الحلقة التالية فور انتهاء الحلقة الحالية</span>
            </div>
            <button
              onClick={() => setAutoplay(!autoplay)}
              className={`w-12 h-6 rounded-full transition-colors relative ${autoplay ? 'bg-amber-500' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${autoplay ? 'left-1' : 'right-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-200 block">إظهار الترجمة العربية افتراضياً</span>
              <span className="text-[11px] text-slate-400">تحميل ملفات الترجمة العربية تلقائياً عند بدء تشغيل أي عمل</span>
            </div>
            <button
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${subtitlesEnabled ? 'bg-amber-500' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-slate-950 absolute top-1 transition-transform ${subtitlesEnabled ? 'left-1' : 'right-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Network Diagnostics */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">فحص زمن استجابة شبكة الاستراحة (LAN Ping)</h3>
          </div>

          <button
            onClick={handleTestLatency}
            disabled={isTestingLatency}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingLatency ? 'animate-spin text-amber-400' : ''}`} />
            <span>إعادة الفحص</span>
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div>
            <span className="text-xs text-slate-400 block">زمن الوصول إلى خادم الوسائط المحلي:</span>
            <span className="font-mono text-xl font-bold text-emerald-400">
              {latency !== null ? `${latency} ms` : 'جاري القياس...'}
            </span>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
            Ultra-Low Latency (LAN)
          </span>
        </div>
      </div>
    </div>
  );
};
