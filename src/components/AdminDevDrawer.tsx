import React from 'react';
import { LoungeUser } from '../types';
import { Translations } from '../lib/i18n';
import { 
  X, Shield, Users, Server, Radio, Database, Code2, 
  FileText, CheckCircle2, Crown, Sparkles, Terminal, CreditCard,
  Building2, Sliders, ShieldCheck, Search, Bot, Activity
} from 'lucide-react';

interface AdminDevDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: LoungeUser;
  allUsers: LoungeUser[];
  onSelectUser: (user: LoungeUser) => void;
  onOpenSystemTab: (tab: string) => void;
  activeSystemTab: string | null;
  t: Translations;
}

export const AdminDevDrawer: React.FC<AdminDevDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers,
  onSelectUser,
  onOpenSystemTab,
  activeSystemTab,
  t
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 h-full border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto text-right shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.devTools}</h3>
                <p className="text-[11px] text-slate-400">بيئة فحص الصلاحيات وربط MikroTik و APIs</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick User Identity Switcher */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              <span>تبديل المستخدم النشط لفحص الصلاحيات:</span>
            </h4>

            <div className="space-y-2">
              {allUsers.map((user) => {
                const isSelected = user.id === currentUser.id;
                const isVIP = user.active_profile.code === 'Premium';
                return (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user)}
                    className={`w-full p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{user.full_name}</span>
                        {isVIP && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-200 text-[10px] font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {user.lounge_id} • {user.active_profile.name}
                      </span>
                    </div>

                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                        نشط
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* System & Architecture Dashboards (Phases 1 - 4) */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>لوحات الفحص المعماري وأنظمة الـ Backend:</span>
            </h4>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onOpenSystemTab('ai-gateway')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'ai-gateway'
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Bot className="w-4 h-4 text-cyan-400" />
                <div className="text-xs">
                  <span className="block font-bold">بوابة الذكاء الاصطناعي والأتمتة (AI Gateway &amp; Autonomy)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Section 10 &amp; 11 • Ollama, RAG, pgvector &amp; Self-Healing</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('observability')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'observability'
                    ? 'bg-blue-500/20 border-blue-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4 text-blue-400" />
                <div className="text-xs">
                  <span className="block font-bold">المراقبة الموزعة والنسخ الاحتياطي (Observability &amp; 3-2-1 DR)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Section 13, 14 &amp; 16 • End-to-End Traces, RPO &amp; RTO</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('search-admin')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'search-admin'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Search className="w-4 h-4 text-amber-400" />
                <div className="text-xs">
                  <span className="block font-bold">ذكاء البحث الموحد والترتيب (Unified Search Engine)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 16 • FTS, Synonyms &amp; Ranking Weights</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('billing')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'billing'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <div className="text-xs">
                  <span className="block font-bold">الاشتراكات والفوترة وتوليد الكروت (Commerce)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 7 • Subscriptions, Plans & Hotspot Cards</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('playback')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'playback'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                <div className="text-xs">
                  <span className="block font-bold">مراقبة التشغيل الآمن و Anti-Sharing</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 6 • Playback Sessions &amp; HMAC Tokens</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('permissions')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'permissions'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-400" />
                <div className="text-xs">
                  <span className="block font-bold">محرك الصلاحيات الهجين (PermissionEngine)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 3 • Decision 59 &amp; 38</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('gateways')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'gateways'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Radio className="w-4 h-4 text-blue-400" />
                <div className="text-xs">
                  <span className="block font-bold">بوابات MikroTik &amp; RADIUS</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 2 • Decision 13 &amp; 14</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('media-accounts')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'media-accounts'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <div className="text-xs">
                  <span className="block font-bold">إدارة حسابات Media Servers (Jellyfin/Emby)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 10 • Decision 11, 18 &amp; 57</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('servers')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'servers'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Server className="w-4 h-4 text-purple-400" />
                <div className="text-xs">
                  <span className="block font-bold">إدارة خوادم الوسائط (Jellyfin/Emby)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 1 &amp; 4 • Decision 15 &amp; 18</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('tenants')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'tenants'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-400" />
                <div className="text-xs">
                  <span className="block font-bold">إدارة المستأجرين والفروع (Multi-Tenancy)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 13 • Tenant Isolation, Quotas &amp; Sites</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('rls-sandbox')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'rls-sandbox'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <div className="text-xs">
                  <span className="block font-bold">مختبر عزل البيانات (RLS Sandbox &amp; Cross-Tenant Audit)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Phase 13 • Row-Level Security Enforcement</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('api')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'api'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Code2 className="w-4 h-4 text-cyan-400" />
                <div className="text-xs">
                  <span className="block font-bold">مستندات REST APIs الكاملة</span>
                  <span className="text-[10px] text-slate-400 font-mono">Swagger / OpenAPI 3.0</span>
                </div>
              </button>

              <button
                onClick={() => onOpenSystemTab('code')}
                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${
                  activeSystemTab === 'code'
                    ? 'bg-amber-500/20 border-amber-500/60 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <div className="text-xs">
                  <span className="block font-bold">كود مشروع Django &amp; Architecture</span>
                  <span className="text-[10px] text-slate-400 font-mono">Backend Apps / DRF</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 font-mono text-center">
          Smart Lounge Architecture v5.0 • Phase 5
        </div>
      </div>
    </div>
  );
};
