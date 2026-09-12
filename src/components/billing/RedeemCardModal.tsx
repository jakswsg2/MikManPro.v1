import React, { useState } from 'react';
import {
  CreditCard,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  HelpCircle,
  Zap,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { LoungeUser, Plan } from '../../types';
import { CardService, SubscriptionEngine } from '../../services/billingEngine';

interface RedeemCardModalProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
  defaultPlan?: Plan | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RedeemCardModal: React.FC<RedeemCardModalProps> = ({
  currentUser,
  t,
  defaultPlan,
  onClose,
  onSuccess
}) => {
  const [cardId, setCardId] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Helper sample cards for instant quick testing in demo
  const sampleCards = [
    { label: 'كرت VIP كبار الشخصيات (30 يوم)', code: 'VIP-10002', pin: '3195', color: 'border-amber-500/40 text-amber-300' },
    { label: 'كرت VIP ثانٍ', code: 'VIP-10003', pin: '7721', color: 'border-amber-500/40 text-amber-300' },
    { label: 'كرت قياسي Standard (30 يوم)', code: 'STD-20002', pin: '9042', color: 'border-indigo-500/40 text-indigo-300' },
    { label: 'كرت أساسي Basic (7 أيام)', code: 'BASIC-30001', pin: '1289', color: 'border-emerald-500/40 text-emerald-300' }
  ];

  const handleQuickFill = (code: string, cardPin: string) => {
    setCardId(code);
    setPin(cardPin);
    setResult(null);
  };

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardId.trim() || !pin.trim()) {
      setResult({ success: false, message: 'يرجى إدخال رقم الكرت ورمز الـ PIN المخدوش.' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    setTimeout(() => {
      const res = CardService.redeemCard(cardId, pin, currentUser.id, currentUser.name);
      setResult({ success: res.success, message: res.message });
      setIsSubmitting(false);

      if (res.success && onSuccess) {
        onSuccess();
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">تفعيل وشحن كرت الاستراحة</h3>
              <p className="text-xs text-slate-400">
                أدخل بيانات كرت شبكة الاستراحة Hotspot لتفعيل أو تجديد باقتك فورياً
              </p>
            </div>
          </div>

          {/* Result Alert */}
          {result && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                result.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs font-semibold leading-relaxed">{result.message}</div>
            </div>
          )}

          {/* Redemption Form */}
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                رقم الكرت التسلسلي (Card ID)
              </label>
              <input
                type="text"
                value={cardId}
                onChange={(e) => setCardId(e.target.value.toUpperCase())}
                placeholder="مثال: VIP-10002 أو STD-20002"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 uppercase tracking-widest focus:outline-none focus:border-amber-500 transition-all"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                رمز الأمان المخدوش (PIN Code)
              </label>
              <input
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-600 tracking-widest focus:outline-none focus:border-indigo-500 transition-all"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !cardId || !pin}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all mt-2"
            >
              {isSubmitting ? (
                <span className="animate-pulse">جاري التحقق والتفعيل...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  شحن وتفعيل الاشتراك الآن
                </>
              )}
            </button>
          </form>

          {/* Demo helper quick fill */}
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              كروت تجريبية جاهزة للتعبئة والشحن الفوري:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sampleCards.map((sc) => (
                <button
                  key={sc.code}
                  type="button"
                  onClick={() => handleQuickFill(sc.code, sc.pin)}
                  className={`p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border ${sc.color} text-right text-[10px] transition-all`}
                >
                  <div className="font-bold font-mono">{sc.code}</div>
                  <div className="text-slate-400">PIN: {sc.pin}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
