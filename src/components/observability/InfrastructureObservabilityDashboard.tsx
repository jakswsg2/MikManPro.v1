import React, { useState } from 'react';
import { DistributedTrace, BackupStatus } from '../../types';
import { INITIAL_DISTRIBUTED_TRACES, INITIAL_BACKUP_STATUS } from '../../data/observabilityData';
import { 
  Activity, Network, ShieldCheck, Server, Database, HardDrive, 
  CheckCircle2, Clock, AlertCircle, RefreshCw, Cpu, Layers, ExternalLink
} from 'lucide-react';

export const InfrastructureObservabilityDashboard: React.FC = () => {
  const [traces, setTraces] = useState<DistributedTrace[]>(INITIAL_DISTRIBUTED_TRACES);
  const [selectedTraceId, setSelectedTraceId] = useState<string>(traces[0].trace_id);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(INITIAL_BACKUP_STATUS);
  const [isSimulatingRestore, setIsSimulatingRestore] = useState(false);

  const selectedTrace = traces.find((t) => t.trace_id === selectedTraceId) || traces[0];

  const handleRunRestoreDrill = () => {
    setIsSimulatingRestore(true);
    setTimeout(() => {
      setBackupStatus((prev) => ({
        ...prev,
        last_snapshot_at: new Date().toISOString(),
        last_restore_drill_status: 'PASSED'
      }));
      setIsSimulatingRestore(false);
    }, 1200);
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'API_GATEWAY':
        return 'bg-blue-500 text-blue-300 border-blue-500/30';
      case 'DJANGO_CORE':
        return 'bg-emerald-500 text-emerald-300 border-emerald-500/30';
      case 'REDIS_CACHE':
        return 'bg-red-500 text-red-300 border-red-500/30';
      case 'POSTGRES_PGVECTOR':
        return 'bg-cyan-500 text-cyan-300 border-cyan-500/30';
      case 'CELERY_WORKER':
        return 'bg-amber-500 text-amber-300 border-amber-500/30';
      case 'JELLYFIN_CONNECTOR':
        return 'bg-purple-500 text-purple-300 border-purple-500/30';
      case 'MIKROTIK_ROUTEROS':
        return 'bg-teal-500 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-500 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border border-blue-500/20 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
              <Activity className="w-3.5 h-3.5" />
              <span>Section 13, 14 & 16: End-to-End Observability & Disaster Recovery</span>
            </div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Network className="w-6 h-6 text-blue-400" />
              <span>المراقبة الموزعة والنسخ الاحتياطي (Observability & Traces)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              تتبع مسار الطلب الكامل عبر خدمات المنظومة:
              <span className="font-mono text-blue-300 block mt-1">
                User → Device → Client → API Gateway → Django → Redis/Celery → PostgreSQL → Media Server
              </span>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-center px-2">
              <span className="block text-lg font-black text-emerald-400">{backupStatus.rpo_minutes} دقيقة</span>
              <span className="text-[10px] text-slate-400 font-bold">RPO (أقصى فقدان)</span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="text-center px-2">
              <span className="block text-lg font-black text-cyan-400">{backupStatus.rto_minutes} دقيقة</span>
              <span className="text-[10px] text-slate-400 font-bold">RTO (زمن التعافي)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-2-1 Backup Strategy & Clean-Room Recovery Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>استراتيجية النسخ الاحتياطي 3-2-1 والتعافي من الكوارث (Disaster Recovery)</span>
            </h3>
            <span className="text-[11px] text-slate-400">{backupStatus.backup_strategy}</span>
          </div>

          <button
            onClick={handleRunRestoreDrill}
            disabled={isSimulatingRestore}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingRestore ? 'animate-spin' : ''}`} />
            <span>{isSimulatingRestore ? 'جاري فحص الاسترجاع...' : 'اختبار الاسترجاع النظيف (Restore Drill)'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">النسخة 1: NVMe محلي</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-bold text-white">PostgreSQL WAL + Dumps</div>
            <span className="text-[10px] text-slate-500">محدثة باستمرار</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">النسخة 2: NAS Storage</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-bold text-white">Synology Btrfs Snapshot</div>
            <span className="text-[10px] text-slate-500">كل 15 دقيقة</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">النسخة 3: سحابية مشفرة</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-bold text-white">Off-site S3 Glacier (AES-256)</div>
            <span className="text-[10px] text-slate-500">تشفير كامل غير قابل للتعديل</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">حالة اختبار الاسترجاع</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                {backupStatus.last_restore_drill_status}
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400">Clean-Room Verified</div>
            <span className="text-[10px] text-slate-500">آخر فحص: منذ قليل</span>
          </div>
        </div>
      </div>

      {/* Distributed Traces Waterfall & Latency Breakdown */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold text-white">
              سجلات التتبع الموزع ومخطط الـ Waterfall (Distributed Tracing)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {traces.map((tr) => (
              <button
                key={tr.trace_id}
                onClick={() => setSelectedTraceId(tr.trace_id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  selectedTraceId === tr.trace_id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tr.trace_id} ({tr.total_duration_ms}ms)
              </button>
            ))}
          </div>
        </div>

        {/* Trace Metadata Bar */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500">المسار: </span>
            <span className="text-blue-400 font-bold">{selectedTrace.http_method} {selectedTrace.endpoint}</span>
          </div>
          <div>
            <span className="text-slate-500">المستخدم: </span>
            <span className="text-slate-300">{selectedTrace.user_id}</span>
          </div>
          <div>
            <span className="text-slate-500">Correlation ID: </span>
            <span className="text-cyan-400">{selectedTrace.correlation_id}</span>
          </div>
          <div>
            <span className="text-slate-500">إجمالي الزمن: </span>
            <span className="text-emerald-400 font-bold">{selectedTrace.total_duration_ms} ms</span>
          </div>
        </div>

        {/* Waterfall Spans View */}
        <div className="space-y-2.5 pt-2">
          {selectedTrace.spans.map((span) => {
            const widthPercent = Math.max(12, (span.duration_ms / selectedTrace.total_duration_ms) * 100);
            return (
              <div key={span.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getServiceColor(span.service)}`}>
                      {span.service}
                    </span>
                    <span className="font-bold text-white">{span.name}</span>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-300">
                    {span.duration_ms} ms
                  </span>
                </div>

                {/* Progress Bar Waterfall */}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>

                {span.details && (
                  <div className="text-[11px] text-slate-400 font-mono">
                    تفاصيل: {span.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
