import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Users,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Receipt,
  Download,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  XCircle,
  CheckCircle,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';
import {
  LoungeUser,
  Subscription,
  CardBatch,
  HotspotCard,
  Invoice,
  Payment,
  BillingDashboardSummary
} from '../../types';
import {
  SubscriptionEngine,
  CardService,
  InvoiceService,
  PaymentService,
  ExpirationService,
  BillingReports
} from '../../services/billingEngine';

interface AdminBillingDashboardProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
}

export const AdminBillingDashboard: React.FC<AdminBillingDashboardProps> = ({
  currentUser,
  t
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'cards' | 'invoices' | 'simulator'>('overview');
  const [summary, setSummary] = useState<BillingDashboardSummary>(BillingReports.getDashboardSummary());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(SubscriptionEngine.getAllSubscriptions());
  const [batches, setBatches] = useState<CardBatch[]>(CardService.getBatches());
  const [cards, setCards] = useState<HotspotCard[]>(CardService.getCards());
  const [invoices, setInvoices] = useState<Invoice[]>(InvoiceService.getInvoices());
  const [payments, setPayments] = useState<Payment[]>(PaymentService.getPayments());

  // Search & Filters
  const [subSearch, setSubSearch] = useState('');
  const [cardSearch, setCardSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Batch Modal State
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [batchPlanId, setBatchPlanId] = useState('plan-vip-30d');
  const [batchCount, setBatchCount] = useState(25);
  const [batchPrefix, setBatchPrefix] = useState('VIP-');
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Expiration Simulator State
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const reloadData = () => {
    setSummary(BillingReports.getDashboardSummary());
    setSubscriptions(SubscriptionEngine.getAllSubscriptions());
    setBatches(CardService.getBatches());
    setCards(CardService.getCards());
    setInvoices(InvoiceService.getInvoices());
    setPayments(PaymentService.getPayments());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Handle Generate Batch
  const handleGenerateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = CardService.generateBatch(batchPlanId, Number(batchCount), batchPrefix, undefined, currentUser.name);
      setBatchFeedback(`تم توليد الدفعة ${res.batch.batch_code} بنجاح بعدد ${res.cards.length} كرت.`);
      reloadData();
      setTimeout(() => {
        setBatchFeedback(null);
        setShowNewBatchModal(false);
      }, 1500);
    } catch (err: any) {
      setBatchFeedback(err.message || 'فشل التوليد');
    }
  };

  // Handle Extend 7 Days
  const handleExtendSubscription = (subId: string) => {
    try {
      SubscriptionEngine.renewSubscription(subId, 7, currentUser.name);
      reloadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Suspend / Resume
  const handleToggleSuspend = (sub: Subscription) => {
    if (sub.status === 'SUSPENDED') {
      SubscriptionEngine.resumeSubscription(sub.id, currentUser.name);
    } else {
      SubscriptionEngine.suspendSubscription(sub.id, 'إيقاف إداري مؤقت', currentUser.name);
    }
    reloadData();
  };

  // Handle Cancel Subscription
  const handleCancelSub = (subId: string) => {
    SubscriptionEngine.cancelSubscription(subId, 'إلغاء إداري من لوحة التحكم', currentUser.name);
    reloadData();
  };

  // Run Expiration Simulator (Celery Worker Simulation)
  const handleRunExpirationCycle = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const res = ExpirationService.processExpirations();
      const logs = [
        `[${new Date().toLocaleTimeString()}] تم تشغيل دورة فحص انتهاء الاشتراكات الدورية (Expiration Worker).`,
        `تحويل إلى فترة السماح (Grace Period): ${res.graceCount} اشتراك.`,
        `تحويل إلى منتهي الصلاحية (Expired): ${res.expiredCount} اشتراك.`,
        ...res.transitions.map(t => `-> المستخدم ${t.user_id}: انتقل من ${t.from} إلى ${t.to}`)
      ];
      setSimulationLog(logs);
      reloadData();
      setIsSimulating(false);
    }, 600);
  };

  // Export CSV
  const handleExportBatch = (batchId: string) => {
    const csv = CardService.exportBatchCsv(batchId);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smart_lounge_cards_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">مركز إدارة الاشتراكات والفوترة والكروت (Commerce Engine)</h2>
            <p className="text-xs text-slate-400">
              إدارة المشتركين، توليد كروت Hotspot، ومراقبة الإيرادات وفترات السماح
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            نظرة عامة (Overview)
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'subscriptions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            الاشتراكات ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            كروت الهوتسبوت ({cards.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'invoices' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            دفتر الفواتير والمقبوضات
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'simulator' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            محاكي الصلاحية (Simulator)
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>المشتركين النشطين (Active)</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {summary.summary.active_subscriptions}
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" />
                {summary.summary.in_grace_period} مستخدم في فترة السماح (Grace)
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>إيرادات اليوم (Today)</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {summary.revenue.today.toLocaleString()} <span className="text-xs font-normal">YER</span>
              </div>
              <div className="text-[11px] text-slate-400">
                الشهر الحالي: <strong className="text-white">{summary.revenue.this_month.toLocaleString()} YER</strong>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>ينتهي خلال 7 أيام</span>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-400 font-mono">
                {summary.summary.expiring_in_7_days}
              </div>
              <div className="text-[11px] text-slate-400">
                انتهت اشتراكاتهم مؤخراً: <strong className="text-rose-400">{summary.summary.expired_last_30_days}</strong>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>مخزون الكروت الجاهزة</span>
                <CreditCard className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono">
                {summary.cards.unused} <span className="text-xs text-slate-400 font-normal">كرت متاح</span>
              </div>
              <div className="text-[11px] text-slate-400">
                كروت شُحنت آخر 30 يوم: <strong className="text-white">{summary.cards.used_last_30_days}</strong>
              </div>
            </div>
          </div>

          {/* Top Plans Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                الباقات الأكثر شعبية واشتراكاً
              </h3>
              <div className="space-y-2">
                {summary.top_plans.map((tp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-white">{tp.plan}</span>
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-amber-400 font-bold">{tp.revenue.toLocaleString()} YER</div>
                      <div className="text-[10px] text-slate-500">{tp.count} مشترك</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  إجراءات وسرعة الفوترة
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  إجراءات فورية لتوليد كروت جديدة، تشغيل فاحص الانتهاء الدوري، وتصدير التقارير.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowNewBatchModal(true)}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20"
                >
                  <Plus className="w-4 h-4" />
                  توليد دفعة كروت جديدة
                </button>

                <button
                  onClick={handleRunExpirationCycle}
                  disabled={isSimulating}
                  className="p-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-600/20"
                >
                  <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
                  تشغيل فحص الصلاحية الآن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIPTIONS TAB */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="بحث بالمستخدم أو الباقة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="ACTIVE">نشط (Active)</option>
                <option value="GRACE_PERIOD">فترة السماح (Grace)</option>
                <option value="EXPIRED">منتهي (Expired)</option>
                <option value="SUSPENDED">معلق (Suspended)</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
            <table className="w-full text-xs text-right text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">المشترك</th>
                  <th className="p-3">الباقة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">تاريخ الانتهاء</th>
                  <th className="p-3">فترة السماح</th>
                  <th className="p-3">المصدر</th>
                  <th className="p-3 text-center">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {subscriptions
                  .filter((s) => {
                    const matchSearch =
                      (s.user_name || '').toLowerCase().includes(subSearch.toLowerCase()) ||
                      (s.plan.name || '').toLowerCase().includes(subSearch.toLowerCase()) ||
                      (s.plan.name_ar || '').toLowerCase().includes(subSearch.toLowerCase());
                    const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition-all">
                      <td className="p-3 font-semibold text-white">
                        {sub.user_name || sub.user_id}
                        <div className="text-[10px] text-slate-500 font-mono">{sub.user_id}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-amber-400">{sub.plan.name_ar || sub.plan.name}</span>
                        <div className="text-[10px] text-slate-400">{sub.price_paid} {sub.currency}</div>
                      </td>
                      <td className="p-3">
                        {sub.status === 'ACTIVE' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            نشط
                          </span>
                        )}
                        {sub.status === 'GRACE_PERIOD' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            فترة سماح
                          </span>
                        )}
                        {sub.status === 'EXPIRED' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            منتهي
                          </span>
                        )}
                        {sub.status === 'SUSPENDED' && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
                            معلق
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        {new Date(sub.expires_at).toLocaleDateString('ar-YE')}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at).toLocaleDateString('ar-YE') : '—'}
                      </td>
                      <td className="p-3 text-[10px] font-mono text-slate-400">
                        {sub.source_type}
                        {sub.source_reference && <div>({sub.source_reference})</div>}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleExtendSubscription(sub.id)}
                            title="تمديد 7 أيام إضافية"
                            className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            +7 أيام
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(sub)}
                            title={sub.status === 'SUSPENDED' ? 'استئناف' : 'تعليق'}
                            className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            {sub.status === 'SUSPENDED' ? 'استئناف' : 'تعليق'}
                          </button>
                          <button
                            onClick={() => handleCancelSub(sub.id)}
                            title="إلغاء الاشتراك"
                            className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            إلغاء
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HOTSPOT CARDS & BATCHES TAB */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          {/* Batches Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              دفعات الكروت المولدة (Card Batches)
            </h3>
            <button
              onClick={() => setShowNewBatchModal(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              توليد دفعة جديدة
            </button>
          </div>

          {/* Batches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-amber-400">{batch.batch_code}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-bold">
                    {batch.status}
                  </span>
                </div>

                <div className="text-xs text-white font-semibold">{batch.plan_name}</div>

                <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-2 rounded-xl text-center text-xs">
                  <div>
                    <div className="text-slate-400 text-[10px]">العدد</div>
                    <div className="font-bold text-white font-mono">{batch.total_cards}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">المستخدم</div>
                    <div className="font-bold text-amber-400 font-mono">{batch.used_cards}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">السعر</div>
                    <div className="font-bold text-emerald-400 font-mono">{batch.price_per_card}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500">
                    بواسطة: {batch.created_by_name}
                  </span>
                  <button
                    onClick={() => handleExportBatch(batch.id)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                  >
                    <Download className="w-3 h-3 text-indigo-400" />
                    تصدير CSV
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Cards Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">قائمة الكروت الفردية ({cards.length})</h3>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
              <table className="w-full text-xs text-right text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">رقم الكرت (Card ID)</th>
                    <th className="p-3">رمز PIN</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">المستخدم المرتبط</th>
                    <th className="p-3">تاريخ التفعيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cards.slice(0, 50).map((card) => (
                    <tr key={card.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-white">{card.card_id}</td>
                      <td className="p-3 font-mono text-amber-400">{card.pin_code}</td>
                      <td className="p-3 font-mono">{card.price} {card.currency}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            card.status === 'UNUSED'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                              : card.status === 'USED'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {card.status}
                        </span>
                      </td>
                      <td className="p-3 text-white font-semibold">
                        {card.linked_user_name || '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {card.activated_at ? new Date(card.activated_at).toLocaleDateString('ar-YE') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVOICES & PAYMENTS TAB */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoices */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                سجل الفواتير الصادرة ({invoices.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-white">{inv.invoice_number}</div>
                      <div className="text-[10px] text-slate-400">{inv.user_name} • {new Date(inv.issued_at).toLocaleDateString('ar-YE')}</div>
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-amber-400 font-bold">{inv.total} {inv.currency}</div>
                      <span className="text-[10px] text-emerald-400 font-bold">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payments Ledger */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                سجل الدفعات والمقبوضات ({payments.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {payments.map((p) => (
                  <div key={p.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-emerald-400">{p.payment_number}</div>
                      <div className="text-[10px] text-slate-400">{p.user_name} • {p.method}</div>
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-white font-bold">{p.amount} {p.currency}</div>
                      <div className="text-[9px] text-slate-500">{p.idempotency_key.substring(0, 16)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRATION SIMULATOR TAB */}
      {activeTab === 'simulator' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              محاكي الصلاحية ودورة انتهاء الاشتراكات (Expiration Worker Simulator)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              في بيئة الإنتاج، تعمل خدمة Celery Worker كل ساعة للتحقق من الاشتراكات المنتهية وتطبيق سياسات فترة السماح (Grace Period) والإنهاء (Expired).
              يمكنك هنا تشغيل الدورة يدوياً لاختبار تأثيرها المباشر على الحسابات والصلاحيات.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRunExpirationCycle}
              disabled={isSimulating}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
              تشغيل محاكي انتهاء الاشتراكات الآن
            </button>
          </div>

          {simulationLog.length > 0 && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 space-y-1">
              <div className="text-slate-400 font-bold mb-2 pb-1 border-b border-slate-800">
                سجل تنفيذ الدورة (Execution Log):
              </div>
              {simulationLog.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NEW BATCH MODAL */}
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              توليد دفعة كروت Hotspot جديدة
            </h3>

            {batchFeedback && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold">
                {batchFeedback}
              </div>
            )}

            <form onSubmit={handleGenerateBatch} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">الباقة المرتبطة بالكروت:</label>
                <select
                  value={batchPlanId}
                  onChange={(e) => setBatchPlanId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="plan-vip-30d">باقة كبار الشخصيات VIP (30 يوم) - 7500 YER</option>
                  <option value="plan-std-30d">الباقة القياسية (30 يوم) - 4500 YER</option>
                  <option value="plan-basic-7d">الباقة الأساسية (7 أيام) - 1500 YER</option>
                  <option value="plan-kids-30d">باقة الأطفال الآمنة (30 يوم) - 2500 YER</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عدد الكروت المراد توليدها:</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">بادئة الكرت (Prefix):</label>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  placeholder="مثال: VIP-"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBatchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  توليد وطباعة الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
