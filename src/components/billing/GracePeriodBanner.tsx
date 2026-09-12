import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, CreditCard, Sparkles, X, ChevronLeft } from 'lucide-react';
import { LoungeUser, Subscription } from '../../types';
import { SubscriptionEngine } from '../../services/billingEngine';

interface GracePeriodBannerProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
  onOpenRedeem: () => void;
  onOpenPlans: () => void;
}

export const GracePeriodBanner: React.FC<GracePeriodBannerProps> = ({
  currentUser,
  t,
  onOpenRedeem,
  onOpenPlans
}) => {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const active = SubscriptionEngine.getActiveSubscription(currentUser.id);
    setSub(active);
  }, [currentUser.id]);

  if (dismissed || !sub) return null;

  const now = Date.now();
  const expiry = new Date(sub.expires_at).getTime();
  const isGrace = sub.status === 'GRACE_PERIOD';
  const isExpiringSoon = sub.status === 'ACTIVE' && expiry - now <= 48 * 60 * 60 * 1000 && expiry > now;

  if (!isGrace && !isExpiringSoon) return null;

  return (
    <div
      className={`relative py-2.5 px-4 text-xs font-medium flex items-center justify-between shadow-md z-40 transition-all ${
        isGrace
          ? 'bg-amber-600/90 text-white backdrop-blur border-b border-amber-500/50'
          : 'bg-indigo-600/90 text-white backdrop-blur border-b border-indigo-500/50'
      }`}
    >
      <div className="flex items-center gap-2.5 flex-1 pr-2">
        {isGrace ? (
          <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
        ) : (
          <Clock className="w-4 h-4 text-indigo-200 shrink-0" />
        )}
        <span>
          {isGrace ? (
            <>
              <strong>تنبيه فترة السماح:</strong> انتهت فترة اشتراكك في باقة (
              {sub.plan.name_ar || sub.plan.name}). سيتم إيقاف الخدمة تلقائياً بعد انتهاء فترة السماح في{' '}
              {sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at).toLocaleDateString('ar-YE') : 'قريباً'}.
            </>
          ) : (
            <>
              <strong>تنبيه انتهاء الاشتراك:</strong> يتبقى أقل من 48 ساعة على انتهاء باقتك الحالية (
              {sub.plan.name_ar || sub.plan.name}).
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenRedeem}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
        >
          <CreditCard className="w-3.5 h-3.5" />
          شحن كرت فوراً
        </button>
        <button
          onClick={onOpenPlans}
          className="px-3 py-1 bg-white text-slate-950 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all"
        >
          تجديد
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
