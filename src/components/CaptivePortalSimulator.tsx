import React, { useState } from 'react';
import {
  Wifi,
  Key,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tv,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Sparkles,
  ExternalLink,
  Lock,
  Server,
  UserCheck,
  Layers,
  Clock,
  Fingerprint
} from 'lucide-react';
import { LoungeUser, Profile } from '../types';
import { PermissionEngineClient } from '../services/permissionEngine';

interface CaptivePortalSimulatorProps {
  currentUser: LoungeUser;
  allUsers: LoungeUser[];
  onLoginSuccess: (user: LoungeUser) => void;
  onNavigateToPortal: () => void;
}

export const CaptivePortalSimulator: React.FC<CaptivePortalSimulatorProps> = ({
  currentUser,
  allUsers,
  onLoginSuccess,
  onNavigateToPortal,
}) => {
  const [deviceType, setDeviceType] = useState<'laptop' | 'phone' | 'tv'>('phone');
  const [cardNumber, setCardNumber] = useState('VIP-77002');
  const [simulatedIp, setSimulatedIp] = useState('192.168.1.104');
  const [simulatedMac, setSimulatedMac] = useState('E4:5F:01:88:B2:10');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [authResult, setAuthResult] = useState<{
    success: boolean;
    user?: LoungeUser;
    isFirstTime?: boolean;
    tokens?: { access: string; refresh: string; session_hash: string };
    ott?: string;
    radiusServerUsed?: string;
    message?: string;
  } | null>(null);

  const presetCards = [
    {
      code: 'VIP-77002',
      label: 'كارت VIP فائق السرعة',
      profile: 'VIP Master (4K HDR + تحميل)',
      badge: 'VIP',
      color: 'border-amber-500/50 text-amber-400 bg-amber-950/20',
    },
    {
      code: 'CARD-10001',
      label: 'كارت قياسي (Standard)',
      profile: 'Basic Lounge (أفلام ومسلسلات)',
      badge: 'Standard',
      color: 'border-blue-500/50 text-blue-400 bg-blue-950/20',
    },
    {
      code: 'KIDS-33010',
      label: 'كارت الأطفال والعائلة',
      profile: 'Kids Safe (محتوى آمن فقط)',
      badge: 'Kids',
      color: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/20',
    },
    {
      code: 'NEW-VISITOR-99',
      label: 'كارت زائر جديد (أول دخول)',
      profile: 'توليد تلقائي لـ Lounge User جديد',
      badge: 'New User (Decision 26)',
      color: 'border-purple-500/50 text-purple-400 bg-purple-950/20',
    },
  ];

  const handleRunSSOAuth = async () => {
    setIsProcessing(true);
    setCurrentStep(1);
    setAuthResult(null);
    setProcessLogs([]);

    const addLog = (text: string) => {
      setProcessLogs((prev) => [...prev, text]);
    };

    addLog(`[الخطوة 1] اتصال الجهاز (${simulatedMac} @ ${simulatedIp}) ببوابة MikroTik Captive Portal`);

    await new Promise((r) => setTimeout(r, 600));
    setCurrentStep(2);
    addLog(`[الخطوة 2] إرسال حزمة RADIUS Access-Request للكارت [${cardNumber}] إلى خادم FreeRADIUS-Core-01`);

    await new Promise((r) => setTimeout(r, 700));
    setCurrentStep(3);
    addLog(`[الخطوة 3] استجابة RADIUS بنجاح (Access-Accept). مجموعة الصلاحيات: ${cardNumber.startsWith('VIP') ? 'VIP_Lounge_4K' : (cardNumber.startsWith('KIDS') ? 'Kids_Safe' : 'Standard')}`);

    await new Promise((r) => setTimeout(r, 600));
    setCurrentStep(4);

    const isExistingUser = cardNumber === 'VIP-77002' || cardNumber === 'CARD-10001' || cardNumber === 'KIDS-33010';
    let targetUser: LoungeUser;
    let isFirstTime = false;

    if (cardNumber === 'VIP-77002') {
      targetUser = allUsers.find((u) => u.username === 'user_b') || allUsers[0];
    } else if (cardNumber === 'KIDS-33010') {
      targetUser = allUsers.find((u) => u.username === 'user_c') || allUsers[0];
    } else if (cardNumber === 'CARD-10001') {
      targetUser = allUsers.find((u) => u.username === 'user_a') || allUsers[0];
    } else {
      // Create new simulated Lounge User (Decision 26)
      isFirstTime = true;
      const randId = Math.floor(100000 + Math.random() * 900000);
      const newLoungeId = `LU-${randId}`;
      targetUser = {
        id: `usr-gen-${randId}`,
        lounge_id: newLoungeId,
        username: `visitor_${cardNumber.toLowerCase().replace('-', '_')}`,
        full_name: `زائر الاستراحة (${cardNumber})`,
        language: 'ar',
        timezone: 'Asia/Aden',
        status: 'ACTIVE',
        is_active: true,
        is_staff: false,
        is_superuser: false,
        active_profile: allUsers[0].active_profile,
        overrides: [],
        created_at: new Date().toISOString(),
        ip_address: simulatedIp,
        connected_device: deviceType === 'laptop' ? 'MacBook Pro LAN' : 'Smartphone 5G WiFi',
      };
    }

    if (isFirstTime) {
      addLog(`[الخطوة 4: Decision 26] لم يتم العثور على هوية سابقة. تم إنشاء Lounge User جديد تلقائياً: ${targetUser.lounge_id}`);
    } else {
      addLog(`[الخطوة 4: Decision 23] تم مطابقة الهوية بحساب الاستراحة الذكية: ${targetUser.lounge_id} (${targetUser.full_name})`);
    }

    await new Promise((r) => setTimeout(r, 600));
    setCurrentStep(5);

    const mockOtt = `ott_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    const mockHash = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const mockAccessJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoi${targetUser.id}\",\"lounge_id\":\"${targetUser.lounge_id}\"}.sig_lan`;
    const mockRefreshJwt = `ref_${Math.random().toString(36).substring(2, 20)}`;

    addLog(`[الخطوة 5: Decision 10] توليد One-Time Token (صلاحية 60 ثانية) وإصدار توكنات الجلسة المشفرة`);
    addLog(`[أمان] تم حفظ تجزئة الجلسة بنجاح (SHA-256: ${mockHash.substring(0, 16)}...) في قاعدة البيانات`);

    setIsProcessing(false);
    setAuthResult({
      success: true,
      user: targetUser,
      isFirstTime,
      tokens: {
        access: mockAccessJwt,
        refresh: mockRefreshJwt,
        session_hash: mockHash,
      },
      ott: mockOtt,
      radiusServerUsed: 'FreeRADIUS-Core-01 (Primary @ 192.168.1.10)',
      message: isFirstTime
        ? 'تم تسجيل الزائر لأول مرة بنجاح وإصدار Lounge ID وربطه بكارت الهوتسبوت'
        : 'تمت مصادقة كارت الهوتسبوت والتعرف على مستخدم الاستراحة ومزامنة الصلاحيات',
    });

    onLoginSuccess(targetUser);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>المرحلة 2: تدفق المصادقة الأحادية (SSO & Captive Portal)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              محاكي تسجيل دخول MikroTik Hotspot
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Decision 1 + 26
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              يحاكي هذا المكوّن تجربة الزائر الحقيقية عند الاتصال بشبكة الواي فاي للاستراحة: إدخال كارت الهوتسبوت،
              الفحص الفوري عبر RADIUS AAA، التوليد التلقائي لـ Lounge User ID، وإصدار توكنات الجلسة مع One-Time Token (OTT).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleRunSSOAuth}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارِ المصادقة...</span>
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4" />
                  <span>بدء محاكاة تسجيل الدخول</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulated Captive Portal UI (4 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                  SL
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-sm">بوابة دخول شبكة الاستراحة</h3>
                  <span className="text-[11px] text-slate-400">MikroTik RouterOS Captive Portal</span>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                LAN Online
              </span>
            </div>

            {/* Device Type Picker */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-2">نوع جهاز الزائر المتصل:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeviceType('phone');
                    setSimulatedMac('E4:5F:01:88:B2:10');
                    setSimulatedIp('192.168.1.104');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                    deviceType === 'phone'
                      ? 'bg-slate-800 border-amber-500/50 text-amber-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>هاتف ذكي</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceType('laptop');
                    setSimulatedMac('F0:18:98:AA:12:44');
                    setSimulatedIp('192.168.1.115');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                    deviceType === 'laptop'
                      ? 'bg-slate-800 border-amber-500/50 text-amber-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>حاسوب محمول</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceType('tv');
                    setSimulatedMac('00:1A:79:4C:E5:88');
                    setSimulatedIp('192.168.1.160');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                    deviceType === 'tv'
                      ? 'bg-slate-800 border-amber-500/50 text-amber-400'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>شاشة Smart TV</span>
                </button>
              </div>
            </div>

            {/* Quick Card Presets */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-400 mb-2">اختر كارت تجريبي سريع:</label>
              <div className="space-y-1.5">
                {presetCards.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCardNumber(c.code)}
                    className={`w-full p-2.5 rounded-xl text-right border text-xs transition flex items-center justify-between ${
                      cardNumber === c.code
                        ? 'bg-slate-800 border-amber-500 text-slate-100 shadow'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="font-bold font-mono text-slate-200">{c.code}</div>
                      <div className="text-[11px] text-slate-400">{c.label} • {c.profile}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${c.color}`}>
                      {c.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card Voucher Input */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  رقم الكارت / قسيمة الدخول (Voucher Code):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.toUpperCase())}
                    placeholder="مثال: VIP-77002 أو CARD-10001"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono tracking-wider focus:outline-none focus:border-amber-500"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 text-xs space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>عنوان IP المخصص للجهاز:</span>
                  <span className="font-mono text-slate-200">{simulatedIp}</span>
                </div>
                <div className="flex justify-between">
                  <span>عنوان الماك (MAC Address):</span>
                  <span className="font-mono text-slate-200">{simulatedMac}</span>
                </div>
                <div className="flex justify-between">
                  <span>بوابة الراوتر (Default Gateway):</span>
                  <span className="font-mono text-slate-200">192.168.1.1</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunSSOAuth}
                disabled={isProcessing || !cardNumber.trim()}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارِ المعالجة والمزامنة...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>دخول وتوثيق الكارت في شبكة الاستراحة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Flow Pipeline & Results (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step Pipeline Visualization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>مراحل معالجة الهوية والمصادقة (5-Step SSO Pipeline)</span>
            </h3>

            <div className="space-y-3">
              {[
                {
                  step: 1,
                  title: 'التقاط هوية المتصل عبر Captive Portal',
                  desc: 'استلام رقم الكارت مع MAC Address و IP Address من طلب التحويل',
                  decision: 'Decision 1',
                },
                {
                  step: 2,
                  title: 'التحقق عبر بوابة RADIUS مع دعم التجاوز (Failover)',
                  desc: 'إرسال Access-Request للخادم الأساسي، ثم الاحتياطي في حال تعذر الوصول',
                  decision: 'Decision 32',
                },
                {
                  step: 3,
                  title: 'استخراج السمات وحساب الوقت المتبقي',
                  desc: 'قراءة Mikrotik-Group و Session-Timeout و Acct-Interim-Interval',
                  decision: 'RFC 2865',
                },
                {
                  step: 4,
                  title: 'التسجيل التلقائي أو مطابقة حساب الاستراحة الذكية',
                  desc: 'فحص جدول ExternalIdentity، أو توليد Lounge User ID جديد تلقائياً عند أول دخول',
                  decision: 'Decision 23 & 26',
                },
                {
                  step: 5,
                  title: 'إصدار One-Time Token وتدوير توكنات الجلسة المشفرة',
                  desc: 'توليد OTT بمدة 60 ثانية للتحويل، وتخزين SHA-256 تجزئة التوكن فقط',
                  decision: 'Decision 10 & 57',
                },
              ].map((item) => {
                const isActive = currentStep === item.step;
                const isCompleted = currentStep > item.step || (authResult && authResult.success);

                return (
                  <div
                    key={item.step}
                    className={`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                      isActive
                        ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-md'
                        : isCompleted
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-400 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 animate-bounce'
                          : isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-xs sm:text-sm text-slate-100">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50">
                          {item.decision}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Logs Console */}
          {processLogs.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80 mb-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  سجل عمليات المصادقة المباشرة (Live Auth Execution Log)
                </span>
                <span className="text-[10px] text-slate-500">SSORegistrationService</span>
              </div>
              <div className="space-y-1 text-slate-300 max-h-40 overflow-y-auto pr-1">
                {processLogs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-emerald-400 select-none">&gt; </span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Authentication Success Result Card */}
          {authResult && authResult.success && authResult.user && (
            <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">
                      {authResult.isFirstTime ? 'تم إنشاء الحساب لأول مرة' : 'تمت المصادقة بنجاح'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">
                      {authResult.user.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-mono">
                      <span>Lounge ID: <strong className="text-amber-400">{authResult.user.lounge_id}</strong></span>
                      <span>•</span>
                      <span>الملف: {authResult.user.active_profile.name}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onNavigateToPortal}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
                >
                  <span>فتح بوابة الوسائط الآن</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>

              {/* Tokens & Security Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
                    <span>تجزئة الجلسة الآمنة (SHA-256 Session Hash):</span>
                  </div>
                  <div className="font-mono text-emerald-400 text-[11px] truncate">
                    {authResult.tokens?.session_hash}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Decision 10: لا يتم حفظ التوكن الصريح، بل تجزئته فقط.
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>رمز المصادقة الأحادية المؤقت (One-Time Token):</span>
                  </div>
                  <div className="font-mono text-amber-300 text-[11px] truncate">
                    {authResult.ott}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    صالح لمرة واحدة ولمدة 60 ثانية للتحويل الآمن (SSO Redirect).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
