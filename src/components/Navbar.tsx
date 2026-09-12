import React, { useState } from 'react';
import { LoungeUser } from '../types';
import { Translations, Language } from '../lib/i18n';
import { 
  Tv, Film, Search, User, Settings, Smartphone, Globe, 
  Crown, Wifi, Terminal, LogIn, LogOut, ChevronDown, Sparkles, CreditCard, Server,
  Radio, MessageSquare
} from 'lucide-react';
import { TenantSwitcher } from './tenancy/TenantSwitcher';
import { NotificationsDropdown } from './notifications/NotificationsDropdown';

interface NavbarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  currentUser: LoungeUser;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenAuthModal: () => void;
  onOpenDevDrawer: () => void;
  onOpenTenantsManagement?: () => void;
  onOpenRLSSandbox?: () => void;
  onLogout: () => void;
  t: Translations;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  currentUser,
  language,
  onLanguageChange,
  onOpenAuthModal,
  onOpenDevDrawer,
  onOpenTenantsManagement,
  onOpenRLSSandbox,
  onLogout,
  t
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const isVIP = currentUser.active_profile.code === 'Premium';

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-6 sm:gap-8">
          {/* Brand Logo */}
          <div 
            onClick={() => setActiveView('home')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              SL
            </div>
            <div className="hidden sm:block text-right">
              <span className="text-sm font-extrabold text-white tracking-tight block leading-tight">
                {t.appName}
              </span>
              <span className="text-[10px] text-amber-400/90 font-mono block">
                LAN Media Portal
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 scrollbar-none">
            {[
              { id: 'home', label: t.home },
              { id: 'movies', label: t.movies },
              { id: 'series', label: t.series },
              { id: 'livetv', label: t.liveTv, icon: Radio },
              { id: 'requests', label: t.requestsAndSupport, icon: MessageSquare },
              { id: 'kids', label: t.kids },
              { id: 'billing', label: t.plans, icon: CreditCard }
            ].map((nav) => {
              const NavIcon = nav.icon;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveView(nav.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                    activeView === nav.id
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {NavIcon && <NavIcon className="w-3 h-3 text-amber-400 shrink-0" />}
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Search, Language, User Profile, Admin Drawer */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Search Trigger */}
          <button
            onClick={() => setActiveView('search')}
            className={`p-2 rounded-xl transition-colors ${
              activeView === 'search'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
            }`}
            title={t.search}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Interactive Notifications Center */}
          <NotificationsDropdown onNavigate={(target) => setActiveView(target)} />

          {/* Multi-Tenant & Site Selector */}
          <div className="hidden sm:block">
            <TenantSwitcher
              onOpenTenantsManagement={onOpenTenantsManagement}
              onOpenRLSSandbox={onOpenRLSSandbox}
            />
          </div>

          {/* Language Switcher */}
          <button
            onClick={() => onLanguageChange(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold border border-slate-800 transition-colors"
            title="Switch Language / تبديل اللغة"
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px] uppercase">{language}</span>
          </button>

          {/* Dev / Architecture Drawer Toggle */}
          <button
            onClick={onOpenDevDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 text-xs font-mono border border-slate-800 transition-colors"
            title="Developer & Architecture Controls"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.devTools}</span>
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all text-right"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-xs text-slate-950">
                {currentUser.full_name.slice(0, 1)}
              </div>
              <div className="hidden lg:block space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white block max-w-[100px] truncate leading-none">
                    {currentUser.full_name}
                  </span>
                  {isVIP && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                </div>
                <span className="text-[10px] text-slate-400 font-mono block leading-none">
                  {currentUser.lounge_id}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showUserDropdown && (
              <div 
                className="absolute left-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-md rounded-2xl p-2 border border-slate-800 shadow-2xl z-50 text-xs space-y-1 animate-fadeIn"
                onClick={() => setShowUserDropdown(false)}
              >
                {/* User Summary */}
                <div className="px-3 py-2 border-b border-slate-800 mb-1 text-right">
                  <div className="font-bold text-white truncate">{currentUser.full_name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {currentUser.active_profile.name} • {currentUser.lounge_id}
                  </div>
                </div>

                <button
                  onClick={() => setActiveView('profile')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.profile}</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('billing')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t.billing}</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('media-accounts')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    <span>حسابات السيرفر (Jellyfin/Emby)</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('sessions')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t.sessions}</span>
                  </div>
                </button>

                <button
                  onClick={() => setActiveView('settings')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.settings}</span>
                  </div>
                </button>

                <div className="border-t border-slate-800 my-1"></div>

                <button
                  onClick={onOpenAuthModal}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-amber-400 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.voucherLogin}</span>
                </button>

                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.logout}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
