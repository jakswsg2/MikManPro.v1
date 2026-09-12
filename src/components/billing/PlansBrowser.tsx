import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Zap,
  Tag,
  Flame,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Layers,
  ChevronRight
} from 'lucide-react';
import { LoungeUser, Plan, AddOn, Promotion } from '../../types';
import { SubscriptionEngine, AddOnSubscriptionService } from '../../services/billingEngine';

interface PlansBrowserProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
  onSelectPlanForRedeem?: (plan: Plan) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

export const PlansBrowser: React.FC<PlansBrowserProps> = ({
  currentUser,
  t,
  onSelectPlanForRedeem,
  onSuccess,
  onClose
}) => {
  const [plans] = useState<Plan[]>(SubscriptionEngine.getPlans());
  const [addons] = useState<AddOn[]>(SubscriptionEngine.getAddOns());
  const [promotions] = useState<Promotion[]>(SubscriptionEngine.getPromotions());
  const [selectedTab, setSelectedTab] = useState<'plans' | 'comparison' | 'addons'>('plans');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [processingAddonId, setProcessingAddonId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeSub = SubscriptionEngine.getActiveSubscription(currentUser.id);

  const handleApplyPromo = () => {
    setPromoError(null);
    if (!promoCode.trim()) return;
    const promo = promotions.find(p => p.code.toUpperCase() === promoCode.trim().toUpperCase() && p.is_active);
    if (promo) {
      setAppliedPromo(promo);
    } else {
      setPromoError('كود الخصم غير صحيح أو منتهي الصلاحية');
    }
  };

  const calculateDiscountedPrice = (plan: Plan) => {
    if (!appliedPromo) return plan.price;
    if (appliedPromo.target_plan_codes && !appliedPromo.target_plan_codes.includes(plan.code)) {
      return plan.price;
    }
    if (appliedPromo.promotion_type === 'DISCOUNT_PERCENT' && appliedPromo.discount_value) {
      const discount = Math.round((plan.price * appliedPromo.discount_value) / 100);
      return Math.max(0, plan.price - discount);
    }
    if (appliedPromo.promotion_type === 'DISCOUNT_FIXED' && appliedPromo.discount_value) {
      return Math.max(0, plan.price - appliedPromo.discount_value);
    }
    return plan.price;
  };

  const handleSubscribePlan = (plan: Plan) => {
    setProcessingPlanId(plan.id);
    setTimeout(() => {
      try {
        SubscriptionEngine.createSubscription(
          currentUser.id,
          currentUser.name,
          plan.id,
          'DIRECT_PURCHASE',
          undefined,
          appliedPromo ? appliedPromo.code : undefined,
          currentUser.name
        );
        setSuccessMessage(`تم تفعيل ${plan.name_ar || plan.name} بنجاح!`);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccessMessage(null);
          if (onClose) onClose();
        }, 2000);
      } catch (err: any) {
        setPromoError(err.message || 'فشل التفعيل');
      } finally {
        setProcessingPlanId(null);
      }
    }, 600);
  };

  const handleSubscribeAddon = (addon: AddOn) => {
    setProcessingAddonId(addon.id);
    setTimeout(() => {
      try {
        AddOnSubscriptionService.grantAddOn(currentUser.id, addon.id);
        setSuccessMessage(`تم تفعيل إضافة ${addon.name_ar || addon.name} بنجاح!`);
        if (onSuccess) onSuccess();
        setTimeout(() => setSuccessMessage(null), 2500);
      } catch (err: any) {
        setPromoError(err.message || 'فشل تفعيل الإضافة');
      } finally {
        setProcessingAddonId(null);
      }
    }, 600);
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <ShieldCheck className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setSelectedTab('plans')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${selectedTab === 'plans' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            باقات الاشتراك (Plans)
          </button>
          <button
            onClick={() => setSelectedTab('comparison')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${selectedTab === 'comparison' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            جدول المقارنة (Comparison)
          </button>
          <button
            onClick={() => setSelectedTab('addons')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${selectedTab === 'addons' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            السوق والإضافات (Add-ons)
          </button>
        </div>

        {/* Promo Code Input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="كود الخصم (مثال: RAMADAN-2026)"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-indigo-500 font-mono w-48"
            />
            {appliedPromo && (
              <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-emerald-500 text-[9px] font-bold text-slate-950 rounded">
                مفعّل ({appliedPromo.discount_value}%)
              </span>
            )}
          </div>
          <button
            onClick={handleApplyPromo}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            تطبيق
          </button>
        </div>
      </div>

      {promoError && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
          {promoError}
        </div>
      )}

      {/* PLANS TAB */}
      {selectedTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = activeSub?.plan.code === plan.code;
            const isVIP = plan.plan_type === 'VIP' || plan.plan_type === 'PREMIUM';
            const price = calculateDiscountedPrice(plan);

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-5 border flex flex-col justify-between transition-all duration-300 ${isCurrent ? 'bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-500/5' : isVIP ? 'bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-500/40 hover:border-indigo-500/70 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}
              >
                {isVIP && (
                  <div className="absolute -top-3 right-4 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1 shadow-md">
                    <Sparkles className="w-3 h-3" />
                    الأكثر تميزاً (Recommended)
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 left-4 px-2.5 py-0.5 bg-emerald-500 rounded-full text-[10px] font-bold text-slate-950 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    باقتك الحالية
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-bold text-white">{plan.name_ar || plan.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 min-h-[32px] line-clamp-2">
                      {plan.description}
                    </p>
                  </div>

                  <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/80">
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-2xl font-black text-white">{price}</span>
                      <span className="text-xs text-amber-400 font-bold">{plan.currency}</span>
                      {price < plan.price && (
                        <span className="text-xs text-slate-500 line-through mr-2">
                          {plan.price} {plan.currency}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      المدة: <span className="text-white font-semibold">{plan.duration_days} يوم</span> ({plan.grace_period_days} أيام فترة سماح)
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>الأفلام والمسلسلات والكرتون</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      {plan.entitlements_template['content.sports.view'] ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span className={plan.entitlements_template['content.sports.view'] ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                        قنوات ومباريات الرياضة المباشرة
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      {plan.entitlements_template['content.premium.view'] ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      )}
                      <span className={plan.entitlements_template['content.premium.view'] ? 'text-purple-400 font-semibold' : 'text-slate-500'}>
                        مكتبة المحتوى الخاص VIP
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>دقة العرض: <strong className="text-cyan-400 uppercase font-mono">{plan.entitlements_template['playback.max_resolution'] || '1080p'}</strong></span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>الأجهزة المتزامنة: <strong className="text-amber-400">{plan.max_concurrent_sessions} أجهزة</strong></span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                  <button
                    onClick={() => handleSubscribePlan(plan)}
                    disabled={processingPlanId === plan.id}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${isVIP ? 'bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-indigo-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
                  >
                    {processingPlanId === plan.id ? (
                      <span className="animate-spin">⏳</span>
                    ) : isCurrent ? (
                      'تجديد هذه الباقة'
                    ) : (
                      'اختيار وتفعيل الباقة'
                    )}
                  </button>

                  {onSelectPlanForRedeem && (
                    <button
                      onClick={() => onSelectPlanForRedeem(plan)}
                      className="w-full py-2 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-1"
                    >
                      <CreditCard className="w-3 h-3 text-amber-400" />
                      شحن بكود كرت
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMPARISON TAB */}
      {selectedTab === 'comparison' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-xs text-right text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">الميزة / الصلاحية</th>
                {plans.map((p) => (
                  <th key={p.id} className="p-3.5 text-center font-bold text-white">
                    {p.name_ar || p.name}
                    <div className="text-[10px] text-amber-400 font-mono font-normal">
                      {p.price} {p.currency}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr>
                <td className="p-3.5 font-medium text-white">مدة الباقة (Duration)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center font-mono">{p.duration_days} يوم</td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">فترة السماح (Grace Period)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center font-mono">{p.grace_period_days} أيام</td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">أقصى دقة تشغيل (Max Resolution)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center uppercase font-mono font-bold text-cyan-400">
                    {p.entitlements_template['playback.max_resolution'] || '1080p'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">سقف الأجهزة المتزامنة (Concurrent Streams)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center font-mono font-bold text-amber-400">
                    {p.max_concurrent_sessions} أجهزة
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">مباريات وقنوات الرياضة (Live Sports)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center">
                    {p.entitlements_template['content.sports.view'] ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">مكتبة المحتوى الخاص (VIP Exclusive)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center">
                    {p.entitlements_template['content.premium.view'] ? (
                      <Check className="w-4 h-4 text-purple-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">التحميل فائق السرعة عبر الشبكة (LAN Download)</td>
                {plans.map(p => (
                  <td key={p.id} className="p-3.5 text-center">
                    {p.entitlements_template['content.download'] ? (
                      <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ADDONS TAB */}
      {selectedTab === 'addons' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {addons.map((addon) => (
            <div
              key={addon.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-bold uppercase">
                    {addon.addon_type}
                  </span>
                  <span className="text-sm font-bold text-amber-400 font-mono">
                    {addon.price} {addon.currency} / {addon.duration_days} يوم
                  </span>
                </div>

                <h4 className="text-base font-bold text-white">{addon.name_ar || addon.name}</h4>
                <p className="text-xs text-slate-400">{addon.description}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => handleSubscribeAddon(addon)}
                  disabled={processingAddonId === addon.id}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {processingAddonId === addon.id ? 'جاري التفعيل...' : 'تفعيل الإضافة الآن'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
