import React, { useState, useMemo } from 'react';
import { MediaItem, LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { ContentCard } from '../streaming/ContentCard';
import { Baby, ShieldCheck, Heart, Sparkles } from 'lucide-react';

interface KidsZoneViewProps {
  mediaItems: MediaItem[];
  currentUser: LoungeUser;
  t: Translations;
  onSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
}

export const KidsZoneView: React.FC<KidsZoneViewProps> = ({
  mediaItems,
  currentUser,
  t,
  onSelect,
  onPlay
}) => {
  const kidsItems = useMemo(() => {
    return mediaItems.filter((i) => i.is_kids);
  }, [mediaItems]);

  return (
    <div className="space-y-6 pb-12">
      {/* Kids Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-600/20 via-purple-600/20 to-amber-500/20 p-6 sm:p-8 border border-pink-500/30 text-right">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>بيئة مشاهدة آمنة 100% للأطفال والعائلة</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            {t.kidsAndFamily}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            أفلام كرتون مدبلجة ورسوم متحركة عائلية ممتعة مختارة بعناية لتناسب جميع الأعمار.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {kidsItems.map((item) => (
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
    </div>
  );
};
