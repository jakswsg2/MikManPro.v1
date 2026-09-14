import React, { useEffect, useState } from 'react';
import {
  Server,
  Radio,
  Cpu,
  Activity,
  HardDrive,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserX,
  Zap,
  Terminal,
  Wifi,
  ExternalLink,
  ChevronDown,
  Layers,
  Database,
  ArrowRight,
  Plus,
  X
} from 'lucide-react';
import {
  MikroTikRouterInfo,
  HotspotActiveUser,
  RadiusServerInfo,
  AuditLogEntry
} from '../types';
import {
  INITIAL_MIKROTIK_ROUTERS,
  INITIAL_HOTSPOT_ACTIVE_USERS,
  INITIAL_RADIUS_SERVERS,
  INITIAL_AUDIT_LOGS
} from '../data/phase2Data';
import { getAccessToken, apiFetch } from '../lib/apiClient';

export const NetworkGatewaysManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'mikrotik' | 'radius' | 'audit'>('mikrotik');
  const [routers, setRouters] = useState<MikroTikRouterInfo[]>(INITIAL_MIKROTIK_ROUTERS);
  const [activeUsers, setActiveUsers] = useState<HotspotActiveUser[]>(INITIAL_HOTSPOT_ACTIVE_USERS);
  const [radiusServers, setRadiusServers] = useState<RadiusServerInfo[]>(INITIAL_RADIUS_SERVERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  const [isPingingRouter, setIsPingingRouter] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latency: number; time: string } | null>(null);

  // RADIUS Failover Simulation state
  const [simulatePrimaryDown, setSimulatePrimaryDown] = useState(false);
  const [testCardNumber, setTestCardNumber] = useState('VIP-77002');
  const [isTestingRadius, setIsTestingRadius] = useState(false);
  const [testRadiusResult, setTestRadiusResult] = useState<{
    success: boolean;
    serverUsed: string;
    latency: number;
    attributes: Record<string, any>;
  } | null>(null);
  const [isAddRouterOpen, setIsAddRouterOpen] = useState(false);
  const [isSavingRouter, setIsSavingRouter] = useState(false);
  const [routerFormError, setRouterFormError] = useState<string | null>(null);
  const [newRouter, setNewRouter] = useState({ name: '', host: '', port: '8728', username: 'lounge_gateway', password: '', use_ssl: false });

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/gateways/mikrotik/routers/')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('تعذر قراءة روترات Django')))
      .then((payload) => {
        if (mounted && Array.isArray(payload.results)) setRouters(payload.results);
      })
      .catch(() => {
        // Keep local data only when the backend is unavailable.
      });
    return () => { mounted = false; };
  }, []);

  const handleAddRouter = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingRouter(true);
    setRouterFormError(null);
    const payload = { ...newRouter, port: Number(newRouter.port) };

    try {
      const response = await apiFetch('/api/v1/gateways/mikrotik/routers/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('تعذر حفظ الراوتر في الخادم الخلفي');
      const saved = await response.json();
      setRouters((current) => [...current, saved]);
    } catch {
      const localRouter: MikroTikRouterInfo = {
        id: `local-router-${Date.now()}`,
        name: newRouter.name,
        host: newRouter.host,
        port: Number(newRouter.port),
        use_ssl: newRouter.use_ssl,
        username: newRouter.username,
        identity: 'بانتظار الفحص',
        routeros_version: 'غير معروف',
        model: 'غير معروف',
        is_online: false,
        is_active: true,
        latency_ms: 0,
        cpu_load: 0,
        memory_free_mb: 0,
        uptime: '-',
        active_hotspot_users_count: 0,
      };
      setRouters((current) => [...current, localRouter]);
      setRouterFormError('تمت الإضافة محليًا فقط. شغّل Backend وراجع الاتصال لحفظه في قاعدة البيانات.');
    }
    setNewRouter({ name: '', host: '', port: '8728', username: 'lounge_gateway', password: '', use_ssl: false });
    setIsSavingRouter(false);
    setIsAddRouterOpen(false);
  };

  // Router ping handler
  const handlePingRouter = async () => {
    setIsPingingRouter(true);
    try {
      const router = routers[0];
      if (!router) throw new Error('لا يوجد روتر محفوظ في Django');
      const response = await apiFetch(`/api/v1/gateways/mikrotik/routers/${router.id}/ping/`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.message || 'فشل فحص MikroTik');
      const health = payload.health;
      setPingResult({ success: true, latency: health.latency_ms, time: new Date().toLocaleTimeString('ar-EG') });
      setRouters((prev) => prev.map((item) => item.id === router.id ? payload.router : item));
    } catch (error) {
      setPingResult(null);
      setRouterFormError(error instanceof Error ? error.message : 'فشل فحص MikroTik الحقيقي');
    }
    setIsPingingRouter(false);
  };

  // Kick Hotspot User handler (Decision 31: Least Privilege active user kick)
  const handleKickUser = (userId: string, userName: string) => {
    setActiveUsers((prev) => prev.filter((u) => u.id !== userId));
    const newAudit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      event_type: 'HOTSPOT_USER_KICKED',
      event_type_display: 'فصل مستخدم من الهوتسبوت',
      external_identity_ref: `HOTSPOT:${userName}`,
      ip_address: '192.168.1.1',
      details: {
        action: 'MikroTikGateway.kick_hotspot_user',
        kicked_by: 'Admin (Least Privilege API)',
        target_user: userName,
      },
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  // Test RADIUS Auth with Failover handler (Decision 32)
  const handleTestRadiusAuth = async () => {
    setIsTestingRadius(true);
    setTestRadiusResult(null);

    await new Promise((r) => setTimeout(r, 700));

    let serverUsedName = 'FreeRADIUS-Core-01 (Primary)';
    let latency = 1.1;

    if (simulatePrimaryDown) {
      serverUsedName = 'FreeRADIUS-Secondary-02 (Standby Failover)';
      latency = 1.4;
    }

    const attrs = {
      'User-Name': testCardNumber,
      'Mikrotik-Group': testCardNumber.startsWith('VIP') ? 'VIP_Lounge_4K' : (testCardNumber.startsWith('KIDS') ? 'Kids_Safe' : 'Standard'),
      'Session-Timeout': testCardNumber.startsWith('VIP') ? 86400 : 28800,
      'Acct-Interim-Interval': 300,
      'Filter-Id': 'lounge_default_firewall_group',
    };

    setTestRadiusResult({
      success: true,
      serverUsed: serverUsedName,
      latency,
      attributes: attrs,
    });

    const newAudit: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      event_type: 'RADIUS_AUTH_TEST',
      event_type_display: 'فحص استجابة خادم RADIUS',
      external_identity_ref: `RADIUS:${testCardNumber}`,
      ip_address: '192.168.1.10',
      details: {
        server_used: serverUsedName,
        failover_active: simulatePrimaryDown,
        latency_ms: latency,
      },
      created_at: new Date().toISOString(),
    };
    setAuditLogs((prev) => [newAudit, ...prev]);

    setIsTestingRadius(false);
  };

  const primaryRouter = routers[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <Server className="w-3.5 h-3.5" />
              <span>المرحلة 2: إدارة بوابات الشبكة والمصادقة (LAN Gateways)</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              بوابات MikroTik RouterOS & خوادم RADIUS AAA
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              تكامل معماري مباشر يربط بين أجهزة الراوتر المركزية وخوادم RADIUS وفق قرارات التصميم:
              صلاحيات الحد الأدنى (Decision 31) وسلسلة التجاوز الثلاثية (Decision 32) وسجل التدقيق الآمن (Decision 35).
            </p>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
            <button
              onClick={() => setActiveSubTab('mikrotik')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'mikrotik'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>راوتر MikroTik</span>
            </button>
            <button
              onClick={() => setActiveSubTab('radius')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'radius'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>خوادم RADIUS (Failover)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === 'audit'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>سجل التدقيق الأمني ({auditLogs.length})</span>
            </button>
            <button
              onClick={() => { setRouterFormError(null); setIsAddRouterOpen(true); }}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة روتر</span>
            </button>
          </div>
        </div>
      </div>

      {routerFormError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {routerFormError}
        </div>
      )}

      {/* TAB 1: MikroTik RouterOS Gateway */}
      {activeSubTab === 'mikrotik' && (
        <div className="space-y-6">
          {/* Router Specs & Live Telemetry Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>اسم وموديل الجهاز</span>
                <Server className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">{primaryRouter.name}</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span className="font-mono text-emerald-400">{primaryRouter.host}:{primaryRouter.port}</span>
                <span>•</span>
                <span>{primaryRouter.model}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>إصدار RouterOS والنظام</span>
                <Terminal className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">{primaryRouter.routeros_version}</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>وقت التشغيل المستمر:</span>
                <span className="font-mono text-slate-200">{primaryRouter.uptime}</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>جهد المعالج والذاكرة الحرة</span>
                <Cpu className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">CPU: {primaryRouter.cpu_load}%</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>الذاكرة الحرة:</span>
                <span className="font-mono text-emerald-400">{primaryRouter.memory_free_mb} MB</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span>زمن الاستجابة (Latency)</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {primaryRouter.latency_ms} ms
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                <span>مستخدمي Hotspot النشطين:</span>
                <span className="font-mono font-bold text-amber-400">{activeUsers.length}</span>
              </div>
            </div>
          </div>

          {/* Interactive Actions & Security Banner */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <span>صلاحيات الحد الأدنى المطبقة (Decision 31: Least Privilege)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    Group: lounge_limited
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  حساب الـ API محصور بصلاحيات: <code className="text-slate-300 font-mono">read, write, test, api</code> فقط، وممنوع تماماً من <code className="text-rose-400 font-mono">reboot, full, sensitive</code> لحماية أمن الشبكة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePingRouter}
                disabled={isPingingRouter}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-2 border border-slate-700 transition disabled:opacity-50"
              >
                {isPingingRouter ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارِ الفحص...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>فحص اتصال الراوتر (Ping)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Hotspot Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Wifi className="w-5 h-5 text-amber-400" />
                  <span>المستخدمون المتصلون حالياً على راوتر الاستراحة (Active Hotspot Users)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  بيانات حية مستخرجة عبر MikroTik API command: <code className="text-slate-300 font-mono">/ip/hotspot/active/print</code>
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {activeUsers.length} أجهزة متصلة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4 font-semibold">المستخدم / الكارت</th>
                    <th className="p-4 font-semibold">عنوان IP للجهاز</th>
                    <th className="p-4 font-semibold">عنوان الماك (MAC)</th>
                    <th className="p-4 font-semibold">مدة الاتصال</th>
                    <th className="p-4 font-semibold">الوقت المتبقي</th>
                    <th className="p-4 font-semibold">حجم البيانات المستهلكة</th>
                    <th className="p-4 font-semibold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {activeUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-mono font-bold text-slate-100">{u.user}</div>
                        <div className="text-[11px] text-slate-400">
                          {u.radius ? 'موثق عبر RADIUS' : 'مستخدم محلي'}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-emerald-400">{u.address}</td>
                      <td className="p-4 font-mono text-slate-400">{u.mac_address}</td>
                      <td className="p-4 font-mono text-slate-300">{u.uptime}</td>
                      <td className="p-4 font-mono text-amber-400">{u.session_time_left}</td>
                      <td className="p-4 font-mono text-slate-400">
                        {(u.bytes_in / (1024 * 1024)).toFixed(1)} MB In / {(u.bytes_out / (1024 * 1024)).toFixed(1)} MB Out
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleKickUser(u.id, u.user)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 mx-auto transition"
                          title="فصل المستخدم من الراوتر فورياً (Decision 31)"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>فصل (Kick)</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RADIUS Gateway (Decision 32: Primary / Secondary / Failover) */}
      {activeSubTab === 'radius' && (
        <div className="space-y-6">
          {/* Topology & Failover Description */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-5">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-amber-400" />
                  <span>معمارية خوادم RADIUS الهجينة (Decision 32: Hybrid AAA Failover)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  يضمن نظام الاستراحة الذكية عدم انقطاع مصادقة الزوار نهائياً:
                  يقوم النظام بإرسال الحزم إلى الخادم الأساسي (Primary)، وإذا تعذر الاتصال يتم التحويل تلقائياً
                  إلى الخادم الاحتياطي (Secondary)، ثم الخادم السحابي (Failover).
                </p>
              </div>

              {/* Failover Simulation Toggle */}
              <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200">محاكاة تعطل السيرفر الأساسي:</div>
                  <div className="text-[11px] text-slate-400">فحص استجابة الـ Failover التلقائي</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSimulatePrimaryDown(!simulatePrimaryDown)}
                  className={`w-12 h-6 rounded-full transition relative flex items-center px-1 ${
                    simulatePrimaryDown ? 'bg-rose-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition transform ${
                      simulatePrimaryDown ? '-translate-x-6' : 'translate-x-0'
                    }`}
                  ></span>
                </button>
              </div>
            </div>

            {/* 3-Tier Server Chain Visualization */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {radiusServers.map((srv, idx) => {
                const isPrimaryOffline = simulatePrimaryDown && srv.role === 'PRIMARY';
                const isCurrentActive = simulatePrimaryDown ? srv.role === 'SECONDARY' : srv.role === 'PRIMARY';

                return (
                  <div
                    key={srv.id}
                    className={`p-5 rounded-2xl border transition relative ${
                      isPrimaryOffline
                        ? 'bg-rose-950/20 border-rose-800/60 text-slate-300'
                        : isCurrentActive
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-lg text-slate-100'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        الأولوية: #{srv.priority}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          isPrimaryOffline
                            ? 'bg-rose-900/40 text-rose-300 border-rose-700'
                            : 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                        }`}
                      >
                        {isPrimaryOffline ? 'غير متاح (محاكاة عطل)' : 'نشط (Online)'}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-100">{srv.name}</h4>
                    <div className="font-mono text-xs text-slate-400 mt-1">
                      {srv.host} : {srv.auth_port} (Auth) / {srv.acct_port} (Acct)
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">زمن الاستجابة (Latency):</span>
                        <span className="font-mono text-emerald-400">{srv.latency_ms} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي الطلبات المعالجة:</span>
                        <span className="font-mono text-slate-200">{srv.total_requests.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Card AAA Tester */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-base text-slate-100 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span>فحص مصادقة كارت هوتسبوت عبر RADIUS Gateway</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              أدخل رقم الكارت لمعاينة حزمة الرد واستخراج السمات (RADIUS Dictionary Attributes).
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testCardNumber}
                onChange={(e) => setTestCardNumber(e.target.value.toUpperCase())}
                placeholder="رقم الكارت (مثال: VIP-77002)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono"
              />
              <button
                onClick={handleTestRadiusAuth}
                disabled={isTestingRadius || !testCardNumber.trim()}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isTestingRadius ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارِ فحص الرد...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>فحص الحزمة عبر السلسلة</span>
                  </>
                )}
              </button>
            </div>

            {testRadiusResult && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تمت المصادقة بنجاح (Access-Accept)</span>
                  </span>
                  <span className="font-mono text-slate-400">
                    الخادم المعالج: <strong className="text-amber-400">{testRadiusResult.serverUsed}</strong> ({testRadiusResult.latency} ms)
                  </span>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                  {Object.entries(testRadiusResult.attributes).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-400">{key}:</span>
                      <span className="text-emerald-400">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Security Audit Log (Decision 35) */}
      {activeSubTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <span>سجل التدقيق الأمني الشامل (Decision 35: Enterprise Audit Log)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يسجل كافة أحداث تسجيل الدخول والربط وتدوير التوكنات دون كشف أي أسرار أو كلمات مرور.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {auditLogs.length} أحداث مسجلة
            </span>
          </div>

          <div className="divide-y divide-slate-800/70">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-800/30 transition text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{log.event_type_display}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                      {log.event_type}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">
                    {new Date(log.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-slate-400 text-[11px] mb-2">
                  {log.user_lounge_id && (
                    <span>
                      المستخدم: <strong className="text-amber-400 font-mono">{log.user_lounge_id}</strong>
                    </span>
                  )}
                  <span>•</span>
                  <span>الهوية: <strong className="text-slate-300 font-mono">{log.external_identity_ref}</strong></span>
                  {log.ip_address && (
                    <>
                      <span>•</span>
                      <span>IP: <strong className="text-emerald-400 font-mono">{log.ip_address}</strong></span>
                    </>
                  )}
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-400">
                  {JSON.stringify(log.details)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAddRouterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleAddRouter} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">إضافة روتر MikroTik</h2>
                <p className="text-xs text-slate-400 mt-1">ستُخزّن كلمة المرور مشفرة في Backend.</p>
              </div>
              <button type="button" onClick={() => setIsAddRouterOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-300">اسم الروتر
                <input required value={newRouter.name} onChange={(event) => setNewRouter({ ...newRouter, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="Lounge Core" />
              </label>
              <label className="text-xs text-slate-300">العنوان IP أو DDNS
                <input required value={newRouter.host} onChange={(event) => setNewRouter({ ...newRouter, host: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono" placeholder="router.example.com أو 192.168.1.1" />
              </label>
              <label className="text-xs text-slate-300">منفذ API
                <input required type="number" min="1" max="65535" value={newRouter.port} onChange={(event) => setNewRouter({ ...newRouter, port: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono" placeholder="8728 أو 8729 أو 443" />
              </label>
              <label className="text-xs text-slate-300">اسم مستخدم API
                <input required value={newRouter.username} onChange={(event) => setNewRouter({ ...newRouter, username: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-300 sm:col-span-2">كلمة مرور API
                <input required type="password" value={newRouter.password} onChange={(event) => setNewRouter({ ...newRouter, password: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={newRouter.use_ssl} onChange={(event) => setNewRouter({ ...newRouter, use_ssl: event.target.checked })} />
              اتصال مشفر API-SSL (يمكن استخدام 443 عبر DDNS)
            </label>
            <p className="text-[11px] leading-relaxed text-slate-400">
              عند استخدام DDNS مع 443، يجب إعداد Port Forward في الراوتر من المنفذ الخارجي 443 إلى منفذ RouterOS API-SSL الداخلي 8729، ثم اكتب اسم DDNS والمنفذ 443 هنا.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsAddRouterOpen(false)} className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800">إلغاء</button>
              <button type="submit" disabled={isSavingRouter} className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                {isSavingRouter ? 'جارِ الحفظ...' : 'حفظ الروتر'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
