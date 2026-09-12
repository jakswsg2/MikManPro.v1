import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  Smartphone, 
  Globe, 
  Shield, 
  Search, 
  Fingerprint,
  Calendar,
  AlertCircle,
  HardDrive
} from 'lucide-react';
import { LoungeUser, Profile, UserStatus } from '../types';

interface LoungeUsersManagerProps {
  users: LoungeUser[];
  profiles: Profile[];
  onAddUser: (user: LoungeUser) => void;
  onSelectUser: (user: LoungeUser) => void;
}

export const LoungeUsersManager: React.FC<LoungeUsersManagerProps> = ({
  users,
  profiles,
  onAddUser,
  onSelectUser,
}) => {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New user form fields
  const [username, setUsername] = useState('khalid_hotel');
  const [fullName, setFullName] = useState('خالد بن محفوظ');
  const [phone, setPhone] = useState('+967 775 554 433');
  const [email, setEmail] = useState('khalid@lounge.lan');
  const [selectedProfileCode, setSelectedProfileCode] = useState('Basic');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.lounge_id.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const profile = profiles.find((p) => p.code === selectedProfileCode) || profiles[0];
    const randomLoungeNum = Math.floor(100000 + Math.random() * 900000);
    
    const newUser: LoungeUser = {
      id: 'usr-' + Date.now(),
      lounge_id: `LU-${randomLoungeNum}`,
      username: username.trim().toLowerCase(),
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      language: 'ar',
      timezone: 'Asia/Aden',
      status: status,
      is_active: status === 'ACTIVE',
      is_staff: false,
      is_superuser: false,
      active_profile: profile,
      overrides: [],
      created_at: new Date().toISOString(),
      ip_address: `192.168.1.${Math.floor(120 + Math.random() * 80)}`,
      connected_device: 'Mobile Client (LAN Hotspot)',
    };

    onAddUser(newUser);
    setShowAddModal(false);
  };

  const getStatusBadge = (st: UserStatus) => {
    switch (st) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'GRACE_PERIOD':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'EXPIRED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'SUSPENDED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>إدارة مستخدمي الاستراحة (Lounge Users)</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            دليل هويات المستخدمين المستقل (Independent Lounge Identity)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            وفقاً للمعايير الهندسية: هوية المستخدم الداخلية مستقلة تماماً وتعتمد معرّف <code className="text-amber-400 font-mono">lounge_id</code>. الربط مع هوية MikroTik/RADIUS يتم لاحقاً في المرحلة الثانية عبر جدول وسيط.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap self-start md:self-auto"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/50 p-2.5 rounded-2xl border border-slate-800">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، اسم المستخدم، أو معرّف LU-XXXXXX..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
          إجمالي المستخدمين: <strong className="text-white font-mono">{users.length}</strong>
        </span>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold">
              <tr>
                <th className="py-3.5 px-4">معرّف الاستراحة والمستخدم</th>
                <th className="py-3.5 px-4">البروفايل المسند</th>
                <th className="py-3.5 px-4">حالة الحساب</th>
                <th className="py-3.5 px-4">عنوان الـ IP المتصل</th>
                <th className="py-3.5 px-4">المنطقة الزمنية</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-850/60 transition-colors">
                  {/* User info */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.full_name} className="w-9 h-9 rounded-xl object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-amber-400">
                          {u.full_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-100 text-xs">{u.full_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            {u.lounge_id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">@{u.username}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Profile */}
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-200 block">
                      {u.active_profile.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {u.active_profile.max_devices} جهاز كحد أقصى
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${getStatusBadge(u.status)}`}>
                      {u.status}
                    </span>
                  </td>

                  {/* LAN IP & Device */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                    <div>{u.ip_address || '192.168.1.100'}</div>
                    <div className="text-[10px] text-slate-500 font-sans truncate max-w-[150px]">
                      {u.connected_device || 'LAN Wi-Fi'}
                    </div>
                  </td>

                  {/* Timezone */}
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {u.timezone}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => onSelectUser(u)}
                      className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors"
                    >
                      فحص وتجربة كـ مستخدم
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>إضافة مستخدم جديد للاستراحة (Lounge User)</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-xs text-slate-400 hover:text-white">
                إغلاق
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المستخدم (Username)</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">بروفايل الصلاحيات المبدئي</label>
                  <select
                    value={selectedProfileCode}
                    onChange={(e) => setSelectedProfileCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">حالة الحساب</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  >
                    <option value="ACTIVE">نشط (Active)</option>
                    <option value="GRACE_PERIOD">فترة سماح (Grace Period)</option>
                    <option value="EXPIRED">منتهي (Expired)</option>
                    <option value="SUSPENDED">معلق (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>توليد تلقائي لمعرّف الاستراحة</span>
                </div>
                <p>
                  سيتم توليد معرّف تسلسلي فريد تلقائياً بصيغة <code className="text-slate-200">LU-XXXXXX</code> وتثبيت المنطقة الزمنية على <code className="text-slate-200">Asia/Aden</code>.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
                >
                  إنشاء وتثبيت المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
