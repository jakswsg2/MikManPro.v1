import { AIModelDefinition, AIWorkflowAudit, SelfHealingAction, AIAutonomyLevel } from '../types';

export const INITIAL_AI_MODELS: AIModelDefinition[] = [
  {
    id: 'model-ollama-llama3',
    name: 'Llama 3.1 8B Instruct (Local Ollama)',
    provider: 'OLLAMA_LOCAL',
    context_window: 128000,
    is_local: true,
    latency_ms: 38,
    parameters: '8.0 Billion (Q4_K_M GGUF)',
    status: 'ONLINE'
  },
  {
    id: 'model-ollama-mistral',
    name: 'Mistral 7B Nemo LAN Optimizer (Local)',
    provider: 'OLLAMA_LOCAL',
    context_window: 32768,
    is_local: true,
    latency_ms: 29,
    parameters: '7.2 Billion (Q5_K_M GGUF)',
    status: 'ONLINE'
  },
  {
    id: 'model-gemini-15',
    name: 'Gemini 1.5 Flash / Pro (Google Cloud AI)',
    provider: 'GEMINI',
    context_window: 1000000,
    is_local: false,
    latency_ms: 320,
    parameters: 'MoE Multimodal Frontier',
    status: 'STANDBY'
  },
  {
    id: 'model-claude-35',
    name: 'Claude 3.5 Sonnet (Cloud Failover)',
    provider: 'CLAUDE',
    context_window: 200000,
    is_local: false,
    latency_ms: 410,
    parameters: 'Enterprise Multimodal',
    status: 'STANDBY'
  }
];

export const INITIAL_AI_AUDITS: AIWorkflowAudit[] = [
  {
    id: 'audit-ai-01',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    user_lounge_id: 'LU-000152',
    query: 'أريد أفلام خيال علمي 4K ذات تقييم أعلى من 8 مناسبة للمشاهدة مع العائلة بدون إعلانات',
    rag_documents_retrieved: 4,
    model_used: 'Llama 3.1 8B Instruct (Local Ollama)',
    autonomy_level: 'L2',
    guardrails_passed: true,
    tool_invoked: 'pgvector_semantic_search + permission_filter',
    execution_result: 'تم استرجاع 3 أفلام متطابقة مع تصريح المستخدم (Interstellar, Dune, Inception) واستبعاد ما يتعارض مع القيود العائلية.',
    latency_ms: 82
  },
  {
    id: 'audit-ai-02',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    user_lounge_id: 'SYSTEM_SUPERVISOR',
    query: 'رصد تذبذب في معدل البت لخادم Jellyfin Alpha للعميل 192.168.88.105',
    rag_documents_retrieved: 6,
    model_used: 'Mistral 7B Nemo LAN Optimizer (Local)',
    autonomy_level: 'L3',
    guardrails_passed: true,
    tool_invoked: 'mikrotik_qos_adjust_bandwidth + jellyfin_transcode_throttle',
    execution_result: 'تم رفع كوتا الـ Burst إلى 45 Mbps عبر بوابات RouterOS API ومنع تقطيع البث.',
    latency_ms: 64
  },
  {
    id: 'audit-ai-03',
    timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
    user_lounge_id: 'LU-000412',
    query: 'كيف يمكنني تشغيل الفيلم على شاشة التلفزيون الذكي في الصالة عبر الـ Cast؟',
    rag_documents_retrieved: 2,
    model_used: 'Llama 3.1 8B Instruct (Local Ollama)',
    autonomy_level: 'L1',
    guardrails_passed: true,
    execution_result: 'تقديم إرشادات ربط Chromecast مع شبكة SmartLounge_5G والتأكد من إيقاف عزل الـ AP Client Isolation.',
    latency_ms: 45
  }
];

export const INITIAL_SELF_HEALING_ACTIONS: SelfHealingAction[] = [
  {
    id: 'sh-01',
    event: 'ارتفاع استهلاك المعالج CPU لخادم الوسائط Jellyfin Alpha إلى 94% بسبب ترانسكودينغ 4K متزامن',
    detected_at: new Date(Date.now() - 12 * 60000).toISOString(),
    severity: 'WARNING',
    policy_rule: 'POL-AUTO-TRANSCODE-THROTTLE (Threshold: CPU > 85% for 60s)',
    autonomy_level: 'L3',
    proposed_action: 'تحويل الجلسة الجديدة إلى Direct Stream وتقليل معدل ترميز الصوت من FLAC إلى AAC 320k',
    status: 'EXECUTED',
    target_service: 'Jellyfin LAN Alpha (192.168.88.240)'
  },
  {
    id: 'sh-02',
    event: 'اكتشاف ازدحام Bufferbloat في Queue Tree لراوتر MikroTik CCR2004 في قسم الصالة العامة',
    detected_at: new Date(Date.now() - 40 * 60000).toISOString(),
    severity: 'INFO',
    policy_rule: 'POL-QOS-CAKE-ADAPTIVE (RTT Jitter > 18ms)',
    autonomy_level: 'L2',
    proposed_action: 'تفعيل خوارزمية fq_codel التلقائية وتحديث حد الـ Limit-At لمجموعة Hotspot_Default',
    status: 'EXECUTED',
    target_service: 'MikroTik Core (192.168.88.1)'
  },
  {
    id: 'sh-03',
    event: 'محاولة تسجيل دخول متكررة بكلمة مرور كرت غير صالحة من عنوان MAC مجهول (Brute Force Suspicion)',
    detected_at: new Date(Date.now() - 95 * 60000).toISOString(),
    severity: 'CRITICAL',
    policy_rule: 'POL-SEC-ZERO-TRUST-LOCKOUT (> 5 failed radius attempts in 1 min)',
    autonomy_level: 'L4',
    proposed_action: 'عزل عنوان الـ MAC مؤقتاً في قائمة RouterOS Address List: "quarantine_host" لمدة 30 دقيقة',
    status: 'EXECUTED',
    target_service: 'RADIUS Auth Gateway + MikroTik Firewall'
  }
];
