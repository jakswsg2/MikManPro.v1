import React, { useState } from 'react';
import { MediaItem, LoungeUser, ExternalPlayerType } from '../../types';
import { Translations } from '../../lib/i18n';
import { PlaybackApiService } from '../../services/playbackEngine';
import { X, ExternalLink, Copy, Check, ShieldAlert, Sparkles, Tv, Smartphone, Monitor } from 'lucide-react';

interface ExternalPlayerModalProps {
  item: MediaItem;
  currentUser: LoungeUser;
  t: Translations;
  onClose: () => void;
}

export const ExternalPlayerModal: React.FC<ExternalPlayerModalProps> = ({
  item,
  currentUser,
  t,
  onClose,
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<ExternalPlayerType>('vlc');
  const [launchData, setLaunchData] = useState<{
    launchUrl: string;
    rawStreamUrl: string;
    token: string;
    instructions: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const players: Array<{
    type: ExternalPlayerType;
    name: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      type: 'vlc',
      name: 'VLC Media Player',
      description: 'أفضل مشغل لفك الترميز التلقائي لجميع الصيغ بدقة 4K و 1080p بدون ضغط.',
      icon: <Monitor className="w-5 h-5" />,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    },
    {
      type: 'infuse',
      name: 'Infuse (Apple TV / iOS)',
      description: 'دعم كامل لـ Dolby Vision و Dolby Atmos ومزامنة العناوين بدقة مذهلة.',
      icon: <Tv className="w-5 h-5" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      type: 'kodi',
      name: 'Kodi Media Center',
      description: 'مناسب للشاشات الذكية وتطبيقات Home Theater.',
      icon: <Tv className="w-5 h-5" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
      type: 'mxplayer',
      name: 'MX Player (Android)',
      description: 'تسريع الأجهزة HW+ ومزامنة الترجمات العربية على هواتف أندرويد.',
      icon: <Smartphone className="w-5 h-5" />,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
  ];

  const handleGenerateLink = async (playerType: ExternalPlayerType) => {
    setIsLoading(true);
    setSelectedPlayer(playerType);

    const device = {
      id: 'dev-curr-01',
      user_id: currentUser.id,
      device_fingerprint: 'fp_web_browser_session',
      device_type: 'DESKTOP' as const,
      device_name: currentUser.connected_device || 'جهاز المتصفح الحالي',
      is_trusted: true,
      is_blocked: false,
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    };

    const res = await PlaybackApiService.launchExternalPlayer(currentUser, device, {
      media_item_id: item.id,
      player_type: playerType,
    });

    setLaunchData({
      launchUrl: res.launch_url,
      rawStreamUrl: res.raw_stream_url,
      token: res.token,
      instructions: res.instructions,
      expiresAt: res.expires_at,
    });
    setIsLoading(false);
  };

  const copyToClipboard = () => {
    if (launchData) {
      navigator.clipboard.writeText(launchData.rawStreamUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">التشغيل عبر مشغل خارجي</h3>
              <p className="text-xs text-slate-400">External Media Player DirectStream</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            يتم إنشاء رابط بث مباشر موقّع بشهادة HMAC مؤقتة (صالحة لمدة 60 ثانية للبدء). لا يتم كشف عناوين الخوادم أو المفاتيح السرية للشبكة.
          </p>
        </div>

        {/* Player Choices */}
        {!launchData ? (
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-300 block">اختر المشغل المثبت على جهازك:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {players.map((p) => (
                <button
                  key={p.type}
                  onClick={() => handleGenerateLink(p.type)}
                  disabled={isLoading}
                  className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between hover:scale-[1.02] cursor-pointer ${
                    p.color
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    {p.icon}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  رابط التشغيل المؤقت جاهز
                </span>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                  TTL: 60s
                </span>
              </div>

              <p className="text-xs text-slate-300">{launchData.instructions}</p>

              {/* Direct Launch Button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={launchData.launchUrl}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح التطبيق مباشرة ({selectedPlayer.toUpperCase()})</span>
                </a>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'تم النسخ بنجاح' : 'نسخ رابط البث'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setLaunchData(null)}
              className="text-xs text-amber-400 hover:underline block mx-auto cursor-pointer"
            >
              ← اختيار مشغل آخر
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
