import React, { useState } from 'react';
import { AppNotification } from '../../types';
import { INITIAL_NOTIFICATIONS } from '../../data/requestsAndSupportData';
import { Bell, CheckCheck, Sparkles, Clock, AlertTriangle, ShieldCheck, Film, ExternalLink } from 'lucide-react';

interface NotificationsDropdownProps {
  onNavigate?: (tab: string) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleItemClick = (notif: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    if (notif.action_target && onNavigate) {
      onNavigate(notif.action_target);
      setIsOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'NEW_EPISODE':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'CARD_EXPIRING':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'REQUEST_APPROVED':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'MAINTENANCE':
        return <AlertTriangle className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all active:scale-95"
        title="مركز الإشعارات التفاعلي"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-3 w-80 sm:w-96 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl z-50 p-4 space-y-3 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">مركز الإشعارات</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                    {unreadCount} غير مقروءة
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تحديد الكل كمقروء</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3 rounded-xl border text-right cursor-pointer transition-all space-y-1.5 ${
                    !notif.is_read
                      ? 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
                      : 'bg-slate-950/60 border-slate-800/50 hover:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                        {getIcon(notif.type)}
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{notif.title}</h4>
                    </div>

                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed pr-8">{notif.message}</p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 font-mono pr-8">
                    <span>{new Date(notif.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                    {notif.action_label && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span>{notif.action_label}</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
