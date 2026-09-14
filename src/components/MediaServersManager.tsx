import React, { useState } from 'react';
import { 
  Server, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  ExternalLink, 
  Key, 
  Globe, 
  HardDrive, 
  Cpu, 
  Activity,
  FolderOpen,
  Film,
  Tv,
  Check,
  Zap,
  Trash2,
  Lock
} from 'lucide-react';
import { MediaServer } from '../types';
import { apiFetch } from '../lib/apiClient';

interface MediaServersManagerProps {
  servers: MediaServer[];
  onAddServer: (server: MediaServer) => Promise<void>;
  onUpdateServer: (server: MediaServer) => Promise<void>;
  onDeleteServer: (id: string) => Promise<void>;
}

export const MediaServersManager: React.FC<MediaServersManagerProps> = ({
  servers,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ id: string; text: string; type: 'success' | 'error' } | null>(null);
  
  // Add server modal / form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('Lounge Media Server 03');
  const [newServerType, setNewServerType] = useState<'jellyfin' | 'emby' | 'plex'>('jellyfin');
  const [newServerUrl, setNewServerUrl] = useState('http://192.168.1.60:8096');
  const [newServerApiKey, setNewServerApiKey] = useState('a1b2c3d4e5f678901234567890abcdef');

  const handleTestConnection = async (server: MediaServer) => {
    setTestingId(server.id);
    setStatusMessage(null);
    try {
      const response = await apiFetch(`/api/v1/media-servers/${server.id}/test-connection/`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.detail || 'فشل الاتصال');
      await onUpdateServer({ ...server, status: 'online', last_ping_at: new Date().toISOString(), server_info: result.server_info || server.server_info });
      setStatusMessage({ id: server.id, text: result.message || 'تم الاتصال بالخادم الحقيقي بنجاح', type: 'success' });
    } catch (error) {
      setStatusMessage({ id: server.id, text: error instanceof Error ? error.message : 'فشل الاتصال بالخادم', type: 'error' });
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncLibraries = async (server: MediaServer) => {
    setSyncingId(server.id);
    setStatusMessage(null);
    try {
      const response = await apiFetch(`/api/v1/media-servers/${server.id}/sync-libraries/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_type: 'FULL' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.detail || 'فشلت المزامنة');
      await onUpdateServer({ ...server, last_sync_at: new Date().toISOString() });
      setStatusMessage({ id: server.id, text: result.message || 'تمت المزامنة من الخادم الحقيقي', type: 'success' });
    } catch (error) {
      setStatusMessage({ id: server.id, text: error instanceof Error ? error.message : 'فشلت المزامنة', type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newServer: MediaServer = {
      id: 'srv-' + Date.now(),
      name: newServerName,
      server_type: newServerType,
      local_url: newServerUrl,
      api_key: newServerApiKey,
      is_active: true,
      status: 'online',
      last_ping_at: new Date().toISOString(),
      libraries_count: 2,
      server_info: {
        server_name: newServerName,
        version: '10.9.11',
        operating_system: 'Linux Docker',
      },
    };
    try {
      await onAddServer(newServer);
      setShowAddForm(false);
      setStatusMessage({ id: newServer.id, text: 'تم حفظ الخادم في Django', type: 'success' });
    } catch (error) {
      setStatusMessage({ id: newServer.id, text: error instanceof Error ? error.message : 'تعذر حفظ الخادم', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              <span>إدارة خوادم الوسائط المحلية</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            خوادم Jellyfin و Emby داخل الشبكة (Local Media Servers)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            تطبيق الاستراحة الذكية يتصل مباشرة عبر الـ REST API بخوادم الوسائط لاكتشاف المكتبات، الأفلام، المسلسلات، المواسم، الحلقات، والتصنيفات، مع تطبيق الصلاحيات بشكل مركزي.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>إضافة خادم وسائط جديد</span>
        </button>
      </div>

      {/* Add Server Form Drawer / Modal */}
      {showAddForm && (
        <div className="bg-slate-900/90 border border-amber-500/30 p-6 rounded-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>إضافة خادم وسائط محلي إلى شبكة الاستراحة</span>
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-white">
              إلغاء
            </button>
          </div>

          <form onSubmit={handleCreateServer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                اسم الخادم (Server Name)
              </label>
              <input
                type="text"
                required
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="مثال: Lounge Media Server 01"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                نوع الخادم (Server Type)
              </label>
              <select
                value={newServerType}
                onChange={(e) => setNewServerType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
              >
                <option value="jellyfin">Jellyfin Media Server (مفتوح المصدر)</option>
                <option value="emby">Emby Media Server</option>
                <option value="plex">Plex Media Server</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                عنوان السيرفر المحلي (LAN Host & Port)
              </label>
              <input
                type="text"
                required
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                placeholder="مثال: http://192.168.1.50:8096"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                مفتاح الـ API (API Key)
              </label>
              <input
                type="password"
                required
                value={newServerApiKey}
                onChange={(e) => setNewServerApiKey(e.target.value)}
                placeholder="مثلاً: 9f8b7a6c5d4e3f2a..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
              >
                حفظ وإضافة الخادم
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Servers List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {servers.map((server) => {
          const isOnline = server.status === 'online';
          const isTesting = testingId === server.id;
          const isSyncing = syncingId === server.id;

          return (
            <div
              key={server.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-all shadow-md"
            >
              {/* Server Top Details */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shadow-inner">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{server.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        server.server_type === 'jellyfin'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {server.server_type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>{server.local_url}</span>
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-1.5">
                  <span className={`flex h-2.5 w-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
                  }`} />
                  <span className={`text-xs font-semibold ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOnline ? 'متصل (Online)' : 'غير متصل'}
                  </span>
                </div>
              </div>

              {/* Status banner message */}
              {statusMessage && statusMessage.id === server.id && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}>
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Server Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">إصدار السيرفر</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {server.server_info?.version || 'v10.9.11'}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">نظام التشغيل</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {server.server_info?.operating_system || 'Linux x86_64'}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block">المكتبات المكتشفة</span>
                  <span className="font-semibold text-amber-400">
                    {server.libraries_count || 3} مكتبات نشطة
                  </span>
                </div>
              </div>

              {/* API Capabilities Discovered */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  العناصر المزامنة عبر REST API:
                </span>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-medium text-slate-300">
                  <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/60">✓ المكتبات والمجلدات</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/60">✓ الأفلام والمسلسلات</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/60">✓ المواسم والحلقات</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/60">✓ البوسترات والخلفيات</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-700/60">✓ روابط البث المباشر LAN</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Test Connection Button */}
                  <button
                    onClick={() => handleTestConnection(server)}
                    disabled={isTesting}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Radio className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-amber-400' : 'text-slate-400'}`} />
                    <span>{isTesting ? 'جاري الفحص...' : 'اختبار الاتصال'}</span>
                  </button>

                  {/* Sync Libraries Button */}
                  <button
                    onClick={() => handleSyncLibraries(server)}
                    disabled={isSyncing}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة المكتبات'}</span>
                  </button>
                </div>

                <button
                  onClick={() => onDeleteServer(server.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="حذف الخادم"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
