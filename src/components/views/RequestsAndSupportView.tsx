import React, { useState } from 'react';
import { ContentRequest, SupportTicket, LoungeUser, ContentRequestStatus } from '../../types';
import { INITIAL_CONTENT_REQUESTS, INITIAL_SUPPORT_TICKETS } from '../../data/requestsAndSupportData';
import { Translations } from '../../lib/i18n';
import { 
  Film, Tv, MessageSquare, Plus, ThumbsUp, CheckCircle2, Clock, 
  HelpCircle, Send, AlertCircle, ArrowUpRight, Search, ShieldCheck, UserCheck
} from 'lucide-react';

interface RequestsAndSupportViewProps {
  currentUser: LoungeUser;
  t: Translations;
}

export const RequestsAndSupportView: React.FC<RequestsAndSupportViewProps> = ({
  currentUser,
  t
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'tickets' | 'faq'>('requests');
  const [requests, setRequests] = useState<ContentRequest[]>(INITIAL_CONTENT_REQUESTS);
  const [tickets, setTickets] = useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);

  // New Request Form state
  const [isAddingRequest, setIsAddingRequest] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqType, setReqType] = useState<'movie' | 'series'>('movie');
  const [reqYear, setReqYear] = useState('2024');
  const [reqNotes, setReqNotes] = useState('');

  // New Ticket Form state
  const [isAddingTicket, setIsAddingTicket] = useState(false);
  const [ticketCategory, setTicketCategory] = useState<'NETWORK_WIFI' | 'PLAYBACK_BUFFERING' | 'VOUCHER_BILLING' | 'GENERAL'>('NETWORK_WIFI');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');

  // Selected Ticket for Chat view
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id || '');
  const [ticketReplyText, setTicketReplyText] = useState('');

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  // Vote handler
  const handleVote = (requestId: string) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          const alreadyVoted = req.voted_by_users.includes(currentUser.id);
          const newVoters = alreadyVoted
            ? req.voted_by_users.filter((id) => id !== currentUser.id)
            : [...req.voted_by_users, currentUser.id];
          return {
            ...req,
            votes: alreadyVoted ? req.votes - 1 : req.votes + 1,
            voted_by_users: newVoters
          };
        }
        return req;
      })
    );
  };

  // Submit new request
  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    const newReq: ContentRequest = {
      id: `req-${Date.now()}`,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      user_lounge_id: currentUser.lounge_id,
      title: reqTitle.trim(),
      media_type: reqType,
      release_year: parseInt(reqYear, 10) || 2024,
      notes: reqNotes.trim(),
      status: 'PENDING',
      votes: 1,
      voted_by_users: [currentUser.id],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setRequests([newReq, ...requests]);
    setReqTitle('');
    setReqNotes('');
    setIsAddingRequest(false);
  };

  // Submit new ticket
  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) return;

    const newTicket: SupportTicket = {
      id: `tkt-${Date.now()}`,
      ticket_number: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      category: ticketCategory,
      title: ticketTitle.trim(),
      description: ticketDesc.trim(),
      priority: 'MEDIUM',
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          ticket_id: `tkt-${Date.now()}`,
          sender_type: 'USER',
          sender_name: currentUser.full_name,
          message: ticketDesc.trim() || ticketTitle.trim(),
          created_at: new Date().toISOString()
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setSelectedTicketId(newTicket.id);
    setTicketTitle('');
    setTicketDesc('');
    setIsAddingTicket(false);
  };

  // Reply to ticket
  const handleReplyTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      ticket_id: selectedTicket.id,
      sender_type: 'USER' as const,
      sender_name: currentUser.full_name,
      message: ticketReplyText.trim(),
      created_at: new Date().toISOString()
    };

    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === selectedTicket.id) {
          return {
            ...t,
            updated_at: new Date().toISOString(),
            messages: [...t.messages, newMsg]
          };
        }
        return t;
      })
    );
    setTicketReplyText('');
  };

  const getStatusBadge = (status: ContentRequestStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold">متاح في المكتبة</span>;
      case 'DOWNLOADING':
        return <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-bold animate-pulse">جاري السحب للـ LAN</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold">معتمد ومجدول</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold">مرفوض</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold">قيد المراجعة</span>;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-950 via-slate-900 to-slate-950 border border-purple-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
              خدمة الزوار وسحب الوسائط المحلية
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              <span>طلبات المحتوى والدعم الفني (Requests & Support)</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              اطلب أي فيلم أو مسلسل غير متوفر في مكتبة الاستراحة ليتم جلبه وحفظه على سيرفرات الـ LAN، أو افتح تذكرة دعم فني مباشرة مع مهندس الشبكة لحل مشاكل الاتصال والتسجيل.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddingRequest(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>طلب فيلم / مسلسل جديد</span>
            </button>
            <button
              onClick={() => setIsAddingTicket(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white font-bold text-xs transition-all active:scale-95"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>فتح تذكرة دعم</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requests'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>طلبات الوسائط ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'tickets'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>تذاكر الدعم الفني ({tickets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'faq'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>الأسئلة الشائعة وإرشادات الشبكة</span>
        </button>
      </div>

      {/* Modal: Add Content Request */}
      {isAddingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                <span>طلب إضافة فيلم أو مسلسل إلى مكتبة الـ LAN</span>
              </h3>
              <button onClick={() => setIsAddingRequest(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم العمل بالإنجليزية أو العربية *</label>
                <input
                  type="text"
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="مثال: Oppenheimer أو مسلسل قيامة عثمان"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نوع العمل</label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="movie">فيلم سينمائي (Movie)</option>
                    <option value="series">مسلسل تلفزيوني (Series)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">سنة الإنتاج</label>
                  <input
                    type="number"
                    value={reqYear}
                    onChange={(e) => setReqYear(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">ملاحظات إضافية (الدقة أو الدبلجة المفضلة)</label>
                <textarea
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  rows={3}
                  placeholder="مثال: يفضل نسخة 4K HDR مع دبلجة عربية"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingRequest(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  إرسال الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Support Ticket */}
      {isAddingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <span>فتح تذكرة دعم فني جديدة</span>
              </h3>
              <button onClick={() => setIsAddingTicket(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">قسم المشكلة *</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="NETWORK_WIFI">شبكة الواي فاي وسرعة الاتصال (Wi-Fi Speed)</option>
                  <option value="PLAYBACK_BUFFERING">تقطيع البث المباشر أو الفيديو (Playback Buffering)</option>
                  <option value="VOUCHER_BILLING">كروت الهوتسبوت والاشتراكات (Hotspot Cards)</option>
                  <option value="GENERAL">استفسار عام أو مساعدة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">عنوان المشكلة *</label>
                <input
                  type="text"
                  required
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  placeholder="مثال: ضعف إشارة الوايفاي في الجلسة الخارجية رقم 4"
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تفاصيل المشكلة</label>
                <textarea
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                  rows={4}
                  required
                  placeholder="وضح ما حدث معك بالتفصيل ونوع جهازك..."
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingTicket(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/30"
                >
                  إنشاء التذكرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 1: Requests List */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => {
              const hasVoted = req.voted_by_users.includes(currentUser.id);
              return (
                <div
                  key={req.id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4 hover:border-purple-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-purple-300">
                            {req.media_type === 'movie' ? 'فيلم' : 'مسلسل'}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{req.release_year}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white line-clamp-1">{req.title}</h3>
                        <p className="text-[11px] text-slate-400">
                          بواسطة: <span className="text-slate-300">{req.user_name}</span> ({req.user_lounge_id})
                        </p>
                      </div>

                      {getStatusBadge(req.status)}
                    </div>

                    {req.notes && (
                      <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                        {req.notes}
                      </p>
                    )}

                    {/* Progress if downloading */}
                    {req.status === 'DOWNLOADING' && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-blue-400 font-mono font-bold">
                          <span>سحب البيانات إلى كاش الـ LAN...</span>
                          <span>{req.progress_percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${req.progress_percent}%` }} />
                        </div>
                      </div>
                    )}

                    {req.admin_reply && (
                      <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-200">
                        <span className="font-bold block text-purple-400 mb-0.5">رد إدارة الشبكة:</span>
                        {req.admin_reply}
                      </div>
                    )}
                  </div>

                  {/* Vote Button */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(req.created_at).toLocaleDateString('ar-SA')}
                    </span>

                    <button
                      onClick={() => handleVote(req.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        hasVoted
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{req.votes} تأييد</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Support Tickets & Interactive Chat */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets List Left */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 mb-2">تذاكرك واستفساراتك المفتوحة:</h3>
            {tickets.map((tkt) => (
              <button
                key={tkt.id}
                onClick={() => setSelectedTicketId(tkt.id)}
                className={`w-full p-4 rounded-2xl border text-right transition-all flex flex-col gap-2 ${
                  selectedTicketId === tkt.id
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-xs font-bold text-amber-400">{tkt.ticket_number}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                    {tkt.status === 'RESOLVED' ? 'تم الحل' : 'قيد المتابعة'}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white line-clamp-1">{tkt.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{tkt.messages.length} رسائل</span>
                  <span>{new Date(tkt.updated_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Ticket Messages & Reply Right */}
          <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between min-h-[420px]">
            {selectedTicket ? (
              <div className="space-y-4">
                {/* Ticket Header */}
                <div className="border-b border-slate-800 pb-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">{selectedTicket.ticket_number}</span>
                      <span className="text-xs font-bold text-slate-400">• {selectedTicket.category}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">{selectedTicket.title}</h3>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
                    الأولوية: {selectedTicket.priority}
                  </span>
                </div>

                {/* Messages Thread */}
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {selectedTicket.messages.map((msg) => {
                    const isUser = msg.sender_type === 'USER';
                    return (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-2xl max-w-[85%] text-xs space-y-1 ${
                          isUser
                            ? 'bg-amber-500/15 border border-amber-500/30 text-slate-100 mr-auto'
                            : 'bg-slate-950 border border-slate-800 text-slate-200 ml-auto'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 font-bold text-[10px]">
                          <span className={isUser ? 'text-amber-300' : 'text-emerald-400'}>
                            {msg.sender_name}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.message}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Box */}
                <form onSubmit={handleReplyTicket} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                    placeholder="اكتب ردك أو استفسارك الإضافي هنا..."
                    className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>إرسال</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">اختر تذكرة لعرض المحادثة</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: FAQs & Knowledge Base */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                q: 'كيف يمكنني تشغيل أفلام 4K على شاشات التلفزيون الذكية عبر VLC؟',
                a: 'اضغط على زر "مشغل خارجي" في صفحة تفاصيل الفيلم، وانسخ رابط البث المباشر المشفر بتوكن الـ HMAC الصالح لمدة 4 ساعات، ثم افتح تطبيق VLC في التلفزيون واختر "Open Network Stream".'
              },
              {
                q: 'هل مشاهدة الأفلام تستهلك من رصيد كرت الهوتسبوت أو الباقة؟',
                a: 'لا على الإطلاق! جميع وسائط الاستراحة مخزنة محلياً على خوادم LAN وتعمل عبر شبكة الـ 1000 Mbps المحلية دون أي استهلاك لبيانات باقة الإنترنت الخارجية.'
              },
              {
                q: 'كيف أقوم بتجديد باقة كرت الإنترنت عند انتهائه؟',
                a: 'توجه إلى تبويب "الاشتراكات والفوترة"، واختر "شحن كرت جديد" وأدخل الكود المطبوع على الكرت، وسيتم تمديد الجلسة فورياً دون تسجيل خروج.'
              },
              {
                q: 'ما هو الحد الأقصى للأجهزة المتزامنة لحساب الـ VIP؟',
                a: 'يتيح حساب الـ VIP تشغيل حتى 3 أجهزة في وقت واحد بدقة 4K HDR مع أولوية قصوى في كروت الشبكة وسرعة التحميل.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
