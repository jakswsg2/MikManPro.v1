import React from 'react';
import { LoungeUser, Permission } from '../../types';
import { Translations } from '../../lib/i18n';
import { INITIAL_PERMISSIONS } from '../../data/initialData';
import { PermissionEngineClient } from '../../services/permissionEngine';
import { 
  User, Shield, Crown, Wifi, CheckCircle2, XCircle, Clock, 
  Smartphone, HardDrive, Zap, LogOut 
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: LoungeUser;
  t: Translations;
  onLogout: () => void;
  onUpgradeToVIP?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  t,
  onLogout,
  onUpgradeToVIP
}) => {
  const effectivePerms = PermissionEngineClient.getEffectivePermissions(currentUser);
  const isVIP = currentUser.active_profile.code === 'Premium' || effectivePerms.has('content.premium.view');

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-right">
      {/* User Header Profile Card */}
      <div className="relative overflow-hidden bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-right">
            {/* Avatar with Status Ring */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl text-amber-400">
                  {currentUser.full_name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900" title="Active Online" />
            </div>

            {/* Name & ID */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {currentUser.full_name}
                </h2>
                {isVIP ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-purple-900/90 text-purple-200 text-xs font-bold flex items-center gap-1 border border-purple-500/30">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    VIP Premium
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700">
                    {currentUser.active_profile.name}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 font-mono">
                {t.loungeId}: <span className="text-amber-400 font-bold">{currentUser.lounge_id}</span> • @{currentUser.username}
              </p>

              <p className="text-xs text-slate-400 pt-1">
                {currentUser.active_profile.description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto">
            {!isVIP && onUpgradeToVIP && (
              <button
                onClick={onUpgradeToVIP}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg transition-all"
              >
                <Crown className="w-4 h-4" />
                <span>{t.upgradeToVIP}</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Permissions & Entitlements Grid */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <span>{t.permissionsList}</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {effectivePerms.size} / {INITIAL_PERMISSIONS.length} {t.permissionGranted}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INITIAL_PERMISSIONS.map((perm) => {
            const hasPerm = effectivePerms.has(perm.code);
            return (
              <div
                key={perm.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                  hasPerm
                    ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                    : 'bg-slate-950/30 border-slate-800/40 text-slate-500 opacity-60'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{perm.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">({perm.code})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{perm.description}</p>
                </div>

                {hasPerm ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold shrink-0 font-mono px-2 py-0.5 rounded bg-emerald-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.permissionGranted}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 font-bold shrink-0 font-mono px-2 py-0.5 rounded bg-slate-800/40">
                    <XCircle className="w-3.5 h-3.5" />
                    {t.permissionDenied}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Network Connection Details Card */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Wifi className="w-5 h-5 text-emerald-400" />
          <span>{t.gatewayInfo}</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">{t.ipAddress}</span>
            <span className="font-mono font-bold text-slate-200">{currentUser.ip_address || '10.0.10.45'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">{t.macAddress}</span>
            <span className="font-mono font-bold text-slate-200">54:AF:97:8C:21:04</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">{t.connectedTo}</span>
            <span className="font-mono font-bold text-slate-200">MikroTik CCR2004</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 block">{t.bandwidth}</span>
            <span className="font-mono font-bold text-emerald-400">{t.unlimited}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
