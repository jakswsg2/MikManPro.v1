import React, { useState } from 'react';
import { 
  Shield, 
  Check, 
  X, 
  Plus, 
  Minus, 
  Crown, 
  UserCheck, 
  Sliders, 
  Sparkles, 
  Lock, 
  Unlock,
  AlertTriangle,
  RotateCcw,
  Zap,
  Info
} from 'lucide-react';
import { LoungeUser, Permission, Profile, UserPermissionOverride } from '../types';
import { PermissionEngineClient } from '../services/permissionEngine';

interface UserPermissionsManagerProps {
  users: LoungeUser[];
  profiles: Profile[];
  permissions: Permission[];
  selectedUser: LoungeUser;
  onSelectUser: (user: LoungeUser) => void;
  onUpdateUser: (user: LoungeUser) => void;
}

export const UserPermissionsManager: React.FC<UserPermissionsManagerProps> = ({
  users,
  profiles,
  permissions,
  selectedUser,
  onSelectUser,
  onUpdateUser,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState(selectedUser.active_profile.id);

  // Switch profile for the selected user
  const handleAssignProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const updated: LoungeUser = {
      ...selectedUser,
      active_profile: profile,
    };
    setSelectedProfileId(profileId);
    onUpdateUser(updated);
  };

  // Toggle individual override
  const handleToggleOverride = (permCode: string) => {
    const perm = permissions.find((p) => p.code === permCode);
    if (!perm) return;

    const currentEffective = PermissionEngineClient.hasPermission(selectedUser, permCode);
    const existingOverrideIndex = selectedUser.overrides.findIndex(
      (o) => o.permission_code === permCode
    );

    let newOverrides: UserPermissionOverride[];

    if (existingOverrideIndex >= 0) {
      // Remove override back to profile default
      newOverrides = selectedUser.overrides.filter((_, idx) => idx !== existingOverrideIndex);
    } else {
      // Create override opposite to profile default
      const isGrantedNew = !currentEffective;
      const newOverride: UserPermissionOverride = {
        id: 'ovr-' + Date.now(),
        permission_code: permCode,
        permission_name: perm.name,
        is_granted: isGrantedNew,
        reason: isGrantedNew ? 'منح استثنائي مؤقت من المشرف' : 'حظر استثنائي من المشرف',
      };
      newOverrides = [...selectedUser.overrides, newOverride];
    }

    const updatedUser: LoungeUser = {
      ...selectedUser,
      overrides: newOverrides,
    };
    onUpdateUser(updatedUser);
  };

  const effectivePerms = PermissionEngineClient.getEffectivePermissions(selectedUser);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>محرك الصلاحيات والاستثناءات الذكي</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            مصفوفة الصلاحيات والاستثناءات الفردية (Permission Matrix Engine)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            وفقاً للمعمارية المعتمدة: Smart Lounge هو السلطة النهائية لصلاحيات المحتوى. يتم دمج بروفايل المستخدم مع أي استثناءات خاصة (Overrides) لحساب الصلاحيات الفعلية.
          </p>
        </div>

        {/* Quick User Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto overflow-x-auto">
          {users.map((u) => {
            const isSelected = u.id === selectedUser.id;
            return (
              <button
                key={u.id}
                onClick={() => {
                  onSelectUser(u);
                  setSelectedProfileId(u.active_profile.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {u.username}
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: User Card & Profile Switcher + Permissions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active User & Profile Selector */}
        <div className="space-y-5">
          {/* User Details Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              {selectedUser.avatar ? (
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.full_name}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-amber-500/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-lg text-amber-400">
                  {selectedUser.full_name.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-white">{selectedUser.full_name}</h3>
                <span className="text-xs font-mono text-slate-400 block">
                  {selectedUser.lounge_id} • @{selectedUser.username}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold inline-block mt-1">
                  {selectedUser.status}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>البروفايل المطبق حالياً:</span>
                <span className="font-bold text-amber-400">{selectedUser.active_profile.name}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>الحد الأقصى للأجهزة:</span>
                <span className="font-mono text-slate-200">{selectedUser.active_profile.max_devices} جهاز</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>الجلسات المتزامنة:</span>
                <span className="font-mono text-slate-200">{selectedUser.active_profile.max_concurrent_sessions} جلسة</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>الاستثناءات الخاصة (Overrides):</span>
                <span className="font-mono text-slate-200">{selectedUser.overrides.length} استثناء</span>
              </div>
            </div>
          </div>

          {/* Profile Assignment Picker */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>تغيير البروفايل المسند للمستخدم</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              اختر أحد القوالب الأساسية المعدة مسبقاً ليتم توريث حزمة الصلاحيات تلقائياً:
            </p>

            <div className="space-y-2 pt-1">
              {profiles.map((p) => {
                const isActive = p.id === selectedUser.active_profile.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAssignProfile(p.id)}
                    className={`w-full text-right p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{p.name}</span>
                      {isActive && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Permission Matrix & Individual Overrides */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>الصلاحيات الفردية والاستثناءات المباشرة (Overrides)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  انقر على زر الاستثناء لمنح أو حظر أي صلاحية بشكل مخصص للمستخدم <strong className="text-slate-200">{selectedUser.username}</strong>
                </p>
              </div>

              {selectedUser.overrides.length > 0 && (
                <button
                  onClick={() => onUpdateUser({ ...selectedUser, overrides: [] })}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs flex items-center gap-1.5 self-start sm:self-auto border border-slate-700"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إلغاء جميع الاستثناءات</span>
                </button>
              )}
            </div>

            {/* Permissions Table / List */}
            <div className="space-y-2.5">
              {permissions.map((perm) => {
                const isEffective = effectivePerms.has(perm.code) || effectivePerms.has('*');
                const fromProfile = selectedUser.active_profile.permissions.includes(perm.code) || selectedUser.active_profile.permissions.includes('*');
                const override = selectedUser.overrides.find((o) => o.permission_code === perm.code);

                return (
                  <div
                    key={perm.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isEffective
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-950/30 border-slate-850 opacity-70'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{perm.name}</span>
                        <code className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {perm.code}
                        </code>
                        {override && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                            override.is_granted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {override.is_granted ? 'استثناء: منح مخصص' : 'استثناء: حظر مخصص'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-lg">
                        {perm.description}
                      </p>
                    </div>

                    {/* Status & Toggle Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-left">
                        <span className={`text-xs font-bold flex items-center gap-1 ${
                          isEffective ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {isEffective ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>مسموح</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>محظور</span>
                            </>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {override ? 'عبر استثناء' : fromProfile ? 'من البروفايل' : 'غير ممنوح'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleOverride(perm.code)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                          override
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                            : isEffective
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                        title="تعديل استثناء لهذه الصلاحية"
                      >
                        {override ? (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>استعادة الافتراضي</span>
                          </>
                        ) : isEffective ? (
                          <>
                            <Minus className="w-3 h-3" />
                            <span>حظر استثنائي</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>منح استثنائي</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
