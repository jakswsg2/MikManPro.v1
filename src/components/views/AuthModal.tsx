import React, { useState } from 'react';
import { LoungeUser } from '../../types';
import { Translations } from '../../lib/i18n';
import { INITIAL_USERS } from '../../data/initialData';
import { SmartLoungeApiClient } from '../../lib/apiClient';
import { 
  X, Wifi, Ticket, User, Lock, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, Sparkles, Crown 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: LoungeUser) => void;
  t: Translations;
  allUsers: LoungeUser[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  t,
  allUsers
}) => {
  const [authMode, setAuthMode] = useState<'voucher' | 'hotspot' | 'credentials'>('voucher');
  const [voucherCode, setVoucherCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      const code = voucherCode.trim().toUpperCase();
      let matchedUser: LoungeUser | undefined;

      if (code.includes('ADMIN')) {
        matchedUser = allUsers.find(u => u.active_profile.code === 'Admin' || u.username === 'admin_tariq') || allUsers[3];
      } else if (code.includes('VIP') || code === 'VIP-999') {
        matchedUser = allUsers.find(u => u.active_profile.code === 'Premium' || u.username === 'sultan_vip' || u.username === 'user_b') || allUsers[1];
      } else if (code.includes('KID')) {
        matchedUser = allUsers.find(u => u.active_profile.code === 'Kids' || u.username === 'karam_kids' || u.username === 'user_c') || allUsers[2];
      } else {
        matchedUser = allUsers.find(u => u.active_profile.code === 'Basic' || u.username === 'ahmed_lan' || u.username === 'user_a') || allUsers[0];
      }

      if (matchedUser) {
        onLoginSuccess(matchedUser);
        setIsLoading(false);
        onClose();
      } else {
        setErrorMessage(t.loginFailed);
        setIsLoading(false);
      }
    }, 500);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      const u = allUsers.find(user => user.username.toLowerCase() === username.trim().toLowerCase());
      if (u) {
        onLoginSuccess(u);
        setIsLoading(false);
        onClose();
      } else {
        // Create user fallback
        const newUser: LoungeUser = {
          id: `user-${Date.now()}`,
          lounge_id: `LU-000${Math.floor(100 + Math.random() * 900)}`,
          username: username.trim(),
          full_name: username.trim(),
          language: 'ar',
          timezone: 'Asia/Riyadh',
          status: 'ACTIVE',
          is_active: true,
          is_staff: false,
          is_superuser: false,
          active_profile: allUsers[0].active_profile,
          overrides: [],
          created_at: new Date().toISOString(),
          ip_address: '10.0.10.60'
        };
        onLoginSuccess(newUser);
        setIsLoading(false);
        onClose();
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-right">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Brand Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Wifi className="w-7 h-7" />
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">{t.welcomeBack}</h3>
          <p className="text-xs text-slate-400">
            تسجيل الدخول لبوابة شبكة الاستراحة وتفعيل باقة الوسائط
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setAuthMode('voucher')}
            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'voucher'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>{t.voucherLogin}</span>
          </button>

          <button
            onClick={() => setAuthMode('credentials')}
            className={`py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'credentials'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.username}</span>
          </button>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Voucher Form */}
        {authMode === 'voucher' && (
          <form onSubmit={handleVoucherSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">كود الكرت المطبوع (Voucher):</label>
              <div className="relative">
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="مثال: VIP-98402 أو BASIC-102"
                  className="w-full h-12 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-4 text-center font-mono font-bold text-base text-amber-400 uppercase tracking-widest outline-hidden transition-colors"
                  required
                />
              </div>
            </div>

            {/* Demo Helper Codes */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <span className="font-semibold text-slate-300 block">أكواد تجريبية سريعة:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setVoucherCode('VIP-98402')}
                  className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 font-mono text-[10px] border border-purple-700"
                >
                  VIP-98402 (باقة VIP Premium)
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherCode('BASIC-102')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700"
                >
                  BASIC-102 (باقة عامة)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.submitLogin}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Username/Password Form */}
        {authMode === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">{t.username}:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full h-11 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-3.5 text-xs text-white outline-hidden transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">{t.password}:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 bg-slate-950 border border-slate-700/80 focus:border-amber-500 rounded-xl px-3.5 text-xs text-white outline-hidden transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
              ) : (
                <>
                  <User className="w-4 h-4" />
                  <span>{t.submitLogin}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
