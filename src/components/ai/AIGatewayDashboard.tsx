import React, { useState } from 'react';
import { AIModelDefinition, AIWorkflowAudit, SelfHealingAction, AIAutonomyLevel } from '../../types';
import { INITIAL_AI_MODELS, INITIAL_AI_AUDITS, INITIAL_SELF_HEALING_ACTIONS } from '../../data/aiArchitectureData';
import { 
  Cpu, Bot, ShieldCheck, Zap, Activity, CheckCircle2, AlertTriangle, 
  Send, RefreshCw, Layers, Database, Lock, Terminal, Sparkles
} from 'lucide-react';

export const AIGatewayDashboard: React.FC = () => {
  const [models, setModels] = useState<AIModelDefinition[]>(INITIAL_AI_MODELS);
  const [selectedModelId, setSelectedModelId] = useState<string>(models[0].id);
  const [autonomyLevel, setAutonomyLevel] = useState<AIAutonomyLevel>('L3');
  const [audits, setAudits] = useState<AIWorkflowAudit[]>(INITIAL_AI_AUDITS);
  const [selfHealingActions, setSelfHealingActions] = useState<SelfHealingAction[]>(INITIAL_SELF_HEALING_ACTIONS);
  
  // Interactive Chat State
  const [queryInput, setQueryInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Array<{ sender: 'USER' | 'AI'; text: string; auditId?: string }>>([
    {
      sender: 'AI',
      text: 'مرحباً بك في بوابة الذكاء الاصطناعي الذاتية (Smart Lounge AI Gateway). يمكنك سؤالي عن وسائط الـ LAN، حالة شبكة الـ MikroTik، سياسات الجلسات، أو فحص الـ Self-Healing التلقائي.'
    }
  ]);

  const selectedModel = models.find((m) => m.id === selectedModelId) || models[0];

  const autonomyDescriptions: Record<AIAutonomyLevel, { name: string; desc: string; color: string }> = {
    L0: { name: 'L0: مراقبة فقط (Monitoring Only)', desc: 'جمع المقاييس والرصد السلبي دون أي اقتراحات أو تنفيذ.', color: 'text-slate-400 bg-slate-800' },
    L1: { name: 'L1: تقديم توصيات (Recommendation)', desc: 'اقتراح إجراءات تحسينية للمشرف البشري دون تنفيذ مباشر.', color: 'text-blue-400 bg-blue-500/10' },
    L2: { name: 'L2: أتمتة آمنة (Safe Automation)', desc: 'تنفيذ تلقائي للعمليات المنخفضة المخاطر مثل تحسين الكاش وتحديث الـ DNS.', color: 'text-emerald-400 bg-emerald-500/10' },
    L3: { name: 'L3: أتمتة مشروطة بالسياسات (Policy-Conditioned)', desc: 'تنفيذ ذاتي مقيّد بقواعد صارمة (مثل خفض جودة البث عند اختناق المعالج).', color: 'text-amber-400 bg-amber-500/10' },
    L4: { name: 'L4: عمليات مستقلة محددة النطاق (Scoped Autonomous)', desc: 'إدارة متكاملة للعزل الأمني والتحويل التلقائي بين خوادم Jellyfin.', color: 'text-purple-400 bg-purple-500/10' },
    L5: { name: 'L5: استقلالية شاملة (Broad Autonomy)', desc: 'معطل افتراضياً - يتطلب موافقة أمنية متعددة المستويات لتعديل البنية التحتية الجوهرية.', color: 'text-red-400 bg-red-500/10' }
  };

  const handleSendQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim() || isProcessing) return;

    const userText = queryInput.trim();
    setQueryInput('');
    setChatLog((prev) => [...prev, { sender: 'USER', text: userText }]);
    setIsProcessing(true);

    setTimeout(() => {
      const isNetworkQuery = userText.includes('شبكة') || userText.includes('وايفاي') || userText.includes('سرعة') || userText.includes('راوتر');
      const isMediaQuery = userText.includes('فيلم') || userText.includes('مسلسل') || userText.includes('بث') || userText.includes('4K');

      let reply = '';
      let tool = '';
      let executionResult = '';

      if (isNetworkQuery) {
        tool = 'mikrotik_qos_api + routeros_traffic_monitor';
        reply = `تم الاستعلام عبر بوابة RouterOS API: راوتر MikroTik Core (192.168.88.1) يعمل باستقرار بنسبة حمل معالج 14%. معدل الـ Jitter في الصالة الرئيسية 2.1ms، وجميع قوائم الـ QoS نشطة بنمط fq_codel.`;
        executionResult = 'تم فحص الـ RouterOS API بنجاح ومطابقة سياسة الـ Zero Trust.';
      } else if (isMediaQuery) {
        tool = 'pgvector_semantic_search + jellyfin_catalog_filter';
        reply = `تم إجراء بحث متجهات دلالي عبر قاعدة PostgreSQL + pgvector: عُثر على 6 وسائط بدقة 4K HDR مطابقة في خادم Jellyfin LAN بدون استهلاك لبيانات الإنترنت الخارجية، وتم التحقق من تصريح المشاهدة النشط.`;
        executionResult = 'تم استرجاع المتجهات والتحقق من صلاحية الجلسة.';
      } else {
        tool = 'smart_lounge_rag_retriever';
        reply = `استناداً إلى قاعدة المعرفة RAG لبوابة Smart Lounge: جميع الأنظمة متصلة ومحمية بسلسلة الحوكمة (Identity → Permission → Policy → Risk → Guardrails → Result → Audit).`;
        executionResult = 'الرد مدعوم بقاعدة RAG المعرفية مع اجتياز كافة حواجز الحماية.';
      }

      const auditId = `audit-${Date.now()}`;
      const newAudit: AIWorkflowAudit = {
        id: auditId,
        timestamp: new Date().toISOString(),
        user_lounge_id: 'LU-000152',
        query: userText,
        rag_documents_retrieved: 4,
        model_used: selectedModel.name,
        autonomy_level: autonomyLevel,
        guardrails_passed: true,
        tool_invoked: tool,
        execution_result: executionResult,
        latency_ms: selectedModel.is_local ? 42 : 310
      };

      setAudits((prev) => [newAudit, ...prev]);
      setChatLog((prev) => [...prev, { sender: 'AI', text: reply, auditId }]);
      setIsProcessing(false);
    }, 600);
  };

  const handleSimulateSelfHealing = () => {
    const newHealing: SelfHealingAction = {
      id: `sh-${Date.now()}`,
      event: 'رصد تذبذب في تدفق حزم Multicast لقناة beIN Sports 1 على محول الـ VLAN 20',
      detected_at: new Date().toISOString(),
      severity: 'WARNING',
      policy_rule: 'POL-IGMP-SNOOPING-AUTO-QUERIER (Packet Loss > 0.5%)',
      autonomy_level: autonomyLevel,
      proposed_action: 'إعادة إرسال IGMP Membership Query وتحديث جدول الـ Snooping على سويتش الصالة',
      status: 'EXECUTED',
      target_service: 'LAN IPTV Core Switch'
    };

    setSelfHealingActions([newHealing, ...selfHealingActions]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-950 border border-cyan-500/20 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
              <Cpu className="w-3.5 h-3.5" />
              <span>Section 10 & 11: Enterprise AI Gateway & Automation Framework</span>
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-cyan-400" />
              <span>بوابة الذكاء الاصطناعي الذاتي والأتمتة الذكية (AI Gateway & Autonomy)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              نموذج تشغيلي متكامل يربط بين نماذج Ollama المحلية ونماذج الحوسبة السحابية مع تطبيق سلسلة الحوكمة الإلزامية:
              <span className="font-mono text-cyan-300 block mt-1">
                Identity → Permission → Policy → Context → RAG → Model → Guardrails → Tool Gateway → Audit
              </span>
            </p>
          </div>

          <button
            onClick={handleSimulateSelfHealing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 active:scale-95 transition-all whitespace-nowrap"
          >
            <Zap className="w-4 h-4" />
            <span>محاكاة علاج ذاتي (Self-Healing)</span>
          </button>
        </div>
      </div>

      {/* Model Registry & Autonomy Level Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Registry */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>سجل النماذج الذكية (Model Registry & Selection)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Local First Architecture</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-2 ${
                  selectedModelId === model.id
                    ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300">
                      {model.is_local ? 'LAN Local' : 'Cloud'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">{model.latency_ms} ms</span>
                  </div>
                  <h4 className="text-xs font-bold line-clamp-1">{model.name}</h4>
                </div>

                <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span>{model.parameters}</span>
                  <span>{model.context_window / 1000}k ctx</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Autonomy Level Slider */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>مستوى الاستقلالية والتحكم الذاتي (Autonomy Level L0 - L5)</span>
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${autonomyDescriptions[autonomyLevel].color}`}>
              {autonomyLevel} النشط
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {(['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as AIAutonomyLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setAutonomyLevel(level)}
                className={`py-2 rounded-xl text-xs font-black transition-all ${
                  autonomyLevel === level
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
            <div className="font-bold text-white">{autonomyDescriptions[autonomyLevel].name}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {autonomyDescriptions[autonomyLevel].desc}
            </p>
          </div>
        </div>
      </div>

      {/* AI Assistant & RAG Query Simulator */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white">
              مساعد Smart Lounge الذاتي المدعوم بالـ RAG و pgvector
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            النموذج النشط: <span className="text-cyan-400 font-bold">{selectedModel.name}</span>
          </span>
        </div>

        {/* Chat Stream */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {chatLog.map((chat, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl max-w-[85%] text-xs space-y-1.5 ${
                chat.sender === 'USER'
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-white mr-auto'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 ml-auto'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[10px]">
                <span className={chat.sender === 'USER' ? 'text-cyan-300' : 'text-emerald-400'}>
                  {chat.sender === 'USER' ? 'المشرف / المستخدم (LU-000152)' : 'مساعد الذكاء الاصطناعي'}
                </span>
                {chat.auditId && (
                  <span className="font-mono text-slate-500 text-[9px]">ID: {chat.auditId}</span>
                )}
              </div>
              <p className="leading-relaxed">{chat.text}</p>
            </div>
          ))}

          {isProcessing && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>جاري تطبيق سلسلة الحوكمة: RAG Retrieval ← Guardrails ← Model Execution...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendQuery} className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="اسأل الذكاء الاصطناعي (مثال: تحقق من سرعة بث الوايفاي، أو ابحث عن أفلام 4K)..."
            className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-600/30 active:scale-95 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>تنفيذ</span>
          </button>
        </form>
      </div>

      {/* Self-Healing Actions Log & Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Self-Healing Actions */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>سجل العلاج الذاتي والتعافي التلقائي (Self-Healing Actions)</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-bold">L2-L4 Safe Policy</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {selfHealingActions.map((act) => (
              <div key={act.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-amber-400">{act.policy_rule}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    {act.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{act.event}</h4>
                <p className="text-[11px] text-slate-400">الإجراء المنفذ: <span className="text-slate-200">{act.proposed_action}</span></p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                  <span>الهدف: {act.target_service}</span>
                  <span>المستوى: {act.autonomy_level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Workflow Audits */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span>سجل تدقيق الحوكمة (AI Governance Audit Trail)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Zero Trust Chain</span>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {audits.map((audit) => (
              <div key={audit.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-cyan-400">{audit.id}</span>
                  <span className="text-slate-400 font-mono">{audit.latency_ms} ms</span>
                </div>
                <div className="text-xs font-bold text-slate-200">الاستعلام: "{audit.query}"</div>
                <div className="text-[11px] text-slate-400">الأداة: <span className="text-purple-300 font-mono">{audit.tool_invoked || 'None'}</span></div>
                <div className="p-2 rounded bg-slate-900 text-[11px] text-slate-300 border border-slate-800/80">
                  {audit.execution_result}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
