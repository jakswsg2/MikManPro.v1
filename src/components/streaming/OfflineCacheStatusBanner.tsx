/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Database, HardDrive, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { CachedLocalStorageService } from '../../services/cachedLocalStorageService';

interface OfflineCacheStatusBannerProps {
  onStatusChange?: (isOnline: boolean) => void;
}

export const OfflineCacheStatusBanner: React.FC<OfflineCacheStatusBannerProps> = ({ onStatusChange }) => {
  const [stats, setStats] = useState(CachedLocalStorageService.getCacheStats());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(CachedLocalStorageService.getCacheStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleStatus = () => {
    const newOnlineState = !stats.isOnline;
    CachedLocalStorageService.setServerOnline(newOnlineState, stats.serverName);
    setStats(CachedLocalStorageService.getCacheStats());
    if (onStatusChange) {
      onStatusChange(newOnlineState);
    }
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      CachedLocalStorageService.setServerOnline(true, stats.serverName);
      setStats(CachedLocalStorageService.getCacheStats());
      setIsSyncing(false);
      if (onStatusChange) onStatusChange(true);
    }, 1000);
  };

  return (
    <div className={`w-full transition-all duration-300 border-b ${
      stats.isOnline 
        ? 'bg-slate-900/40 border-slate-800/60 text-slate-300' 
        : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Status Badge & Message */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleStatus}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold transition-all shadow-sm ${
              stats.isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
            }`}
            title="انقر لتبديل حالة اتصال السيرفر المحلي (جريبي للاختبار)"
          >
            {stats.isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>سيرفر الشبكة متصل (LAN Online)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>السيرفر غير متصل • وضع التخزين المؤقت (Offline Cache)</span>
              </>
            )}
          </button>

          <span className="hidden md:inline text-slate-400 font-mono text-[11px]">
            {stats.serverName}
          </span>
        </div>

        {/* Right: Cache Stats & Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-400" />
              <span>{stats.itemCount} مادة مخزنة</span>
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-400" />
              <span>{stats.storageSizeKb} KB</span>
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
          >
            {isExpanded ? 'إخفاء التفاصيل' : 'تفاصيل التخزين المؤقت'}
          </button>

          {!stats.isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors shadow"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>إعادة الاتصال بالسيرفر</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 bg-slate-900/90 border-t border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-slate-400 block font-bold">حالة التخزين المحلي (Cached Local Storage)</span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              يقوم نظام التخزين المؤقت بحفظ بيانات المكتبات، الملصقات، وتاريخ المشاهدة في متصفحك تلقائياً لضمان استمرارية التصفح ومشاهدة المحتوى عند انقطاع اتصال سيرفر Jellyfin/Emby المحلي.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block font-bold">إحصائيات الكاش (Cache Metrics)</span>
            <div className="space-y-0.5 font-mono text-[11px] text-slate-300">
              <div>• المواد المؤرشفة: <span className="text-amber-400 font-bold">{stats.itemCount}</span></div>
              <div>• سجلات المشاهدة المحفوظة: <span className="text-emerald-400 font-bold">{stats.historyCount}</span></div>
              <div>• المساحة المستهلكة: <span className="text-blue-400 font-bold">{stats.storageSizeKb} KB</span></div>
            </div>
          </div>

          <div className="space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-slate-400 block font-bold">آخر مزامنة ناجحة</span>
              <span className="font-mono text-[11px] text-slate-300">
                {new Date(stats.lastCachedAt).toLocaleString('ar-SA')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث الكاش الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
