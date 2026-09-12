import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Tv,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  XCircle,
  Film,
  Download,
  Flame,
  FileText
} from 'lucide-react';
import { LoungeUser, Subscription } from '../../types';
import { SubscriptionEngine, EntitlementEngine } from '../../services/billingEngine';

interface SubscriptionOverviewProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
  onOpenPlans: () => void;
  onOpenRedeem: () => void;
  onOpenInvoices: () => void;
}

export const SubscriptionOverview: React.FC<SubscriptionOverviewProps> = ({
  currentUser,
  t,
  onOpenPlans,
  onOpenRedeem,
  onOpenInvoices
}) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entitlements, setEntitlements] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    const sub = SubscriptionEngine.getActiveSubscription(currentUser.id) ||
      SubscriptionEngine.getUserSubscriptions(currentUser.id)[0] || null;
    setSubscription(sub);
    setEntitlements(EntitlementEngine.computeEntitlements(currentUser.id));
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id]);

  useEffect(() => {
    if (!subscription) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const targetDate = subscription.status === 'GRACE_PERIOD' && subscription.grace_period_ends_at
        ? new Date(subscription.grace_period_ends_at).getTime()
        : new Date(subscription.expires_at).getTime();

      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [subscription]);

  const handleRenew = () => {
    if (!subscription) return;
    setIsRenewing(true);
    setTimeout(() => {
      try {
        SubscriptionEngine.renewSubscription(subscription.id, subscription.plan.duration_days, currentUser.name);
        loadData();
        setFeedback('تم تجديد باقة الاشتراك بنجاح!');
        setTimeout(() => setFeedback(null), 4000);
      } catch (err: any) {
        setFeedback(err.message || 'فشل التجديد');
      } finally {
        setIsRenewing(false);
      }
    }, 600);
  };

  const getStatusBadge = () => {
    if (!subscription) {
      return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          لا يوجد اشتراك
        </span>
      );
    }
    switch (subscription.status) {
      case 'ACTIVE':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            اشتراك نشط (Active)
          </span>
        );
      case 'GRACE_PERIOD':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 animate-bounce">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            فترة السماح (Grace Period)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            منتهي الصلاحية (Expired)
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            معلق إدارياً (Suspended)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400">
            {subscription.status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium flex items-center justify-between animate-fade-in">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-emerald-300">
            ✕
          </button>
        </div>
      )}

      {/* Main Subscription Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 shadow-xl">
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">
                    {subscription ? (subscription.plan.name_ar || subscription.plan.name) : 'لا يوجد باقة نشطة'}
                  </h3>
                  {getStatusBadge()}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {subscription ? subscription.plan.description : 'اختر باقة أو اشحن كرت الاستراحة للوصول إلى المحتوى'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenRedeem}
                className="px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <CreditCard className="w-3.5 h-3.5" />
                شحن كرت (Redeem)
              </button>
              <button
                onClick={onOpenInvoices}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                سجل الفواتير
              </button>
            </div>
          </div>

          {/* Countdown & Expiration info */}
          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    {subscription.status === 'GRACE_PERIOD' ? 'المتبقي على انتهاء فترة السماح:' : 'المتبقي على انتهاء الاشتراك:'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ينتهي في: {new Date(subscription.expires_at).toLocaleDateString('ar-YE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {timeLeft ? (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">
                        {String(timeLeft.days).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">يوم (Days)</div>
                    </div>
                    <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black text-white font-mono">
                        {String(timeLeft.hours).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">ساعة (Hours)</div>
                    </div>
                    <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black text-white font-mono">
                        {String(timeLeft.minutes).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">دقيقة (Min)</div>
                    </div>
                    <div className="bg-slate-900/80 rounded-lg p-2 border border-slate-800">
                      <div className="text-xl md:text-2xl font-black text-indigo-400 font-mono animate-pulse">
                        {String(timeLeft.seconds).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">ثانية (Sec)</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-sm font-medium">الاشتراك منتهي</div>
                )}
              </div>

              {/* Quick Plan Actions */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-col justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">سعر الباقة والتجديد:</div>
                  <div className="text-lg font-bold text-white font-mono flex items-baseline gap-1">
                    <span>{subscription.price_paid || subscription.plan.price}</span>
                    <span className="text-xs text-amber-400 font-normal">{subscription.currency || 'YER'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleRenew}
                    disabled={isRenewing}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRenewing ? 'animate-spin' : ''}`} />
                    تجديد الباقة
                  </button>
                  <button
                    onClick={onOpenPlans}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    ترقية أو تغيير الباقة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Entitlements & Features Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              الميزات والصلاحيات المكتسبة في باقتك (Active Entitlements)
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${entitlements['content.movies.view'] ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'}`}>
                <Film className={`w-4 h-4 ${entitlements['content.movies.view'] ? 'text-indigo-400' : 'text-slate-600'}`} />
                <div className="text-xs">
                  <div className="font-semibold">الأفلام والمسلسلات</div>
                  <div className="text-[10px] text-slate-400">{entitlements['content.movies.view'] ? 'مسموح' : 'غير متاح'}</div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${entitlements['content.sports.view'] ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'}`}>
                <Flame className={`w-4 h-4 ${entitlements['content.sports.view'] ? 'text-amber-400' : 'text-slate-600'}`} />
                <div className="text-xs">
                  <div className="font-semibold">قنوات ومباريات الرياضة</div>
                  <div className="text-[10px] text-slate-400">{entitlements['content.sports.view'] ? 'متاح (VIP)' : 'غير متاح'}</div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${entitlements['content.premium.view'] ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'}`}>
                <Sparkles className={`w-4 h-4 ${entitlements['content.premium.view'] ? 'text-purple-400' : 'text-slate-600'}`} />
                <div className="text-xs">
                  <div className="font-semibold">المحتوى الخاص VIP</div>
                  <div className="text-[10px] text-slate-400">{entitlements['content.premium.view'] ? 'مفتوح بالكامل' : 'مقفل'}</div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${entitlements['content.download'] ? 'bg-slate-900/60 border-slate-800 text-slate-200' : 'bg-slate-950/40 border-slate-900 text-slate-600'}`}>
                <Download className={`w-4 h-4 ${entitlements['content.download'] ? 'text-emerald-400' : 'text-slate-600'}`} />
                <div className="text-xs">
                  <div className="font-semibold">التحميل المحلي المباشر</div>
                  <div className="text-[10px] text-slate-400">{entitlements['content.download'] ? 'متاح فائق السرعة' : 'مشاهدة فقط'}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-200 flex items-center gap-2.5">
                <Tv className="w-4 h-4 text-cyan-400" />
                <div className="text-xs">
                  <div className="font-semibold">أقصى دقة تشغيل</div>
                  <div className="text-[10px] text-cyan-400 font-mono font-bold uppercase">{entitlements['playback.max_resolution'] || '1080p'}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-slate-900/60 border-slate-800 text-slate-200 flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <div className="text-xs">
                  <div className="font-semibold">سقف الأجهزة المتزامنة</div>
                  <div className="text-[10px] text-amber-400 font-mono font-bold">{entitlements['max_concurrent_sessions'] || 1} أجهزة في نفس الوقت</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
