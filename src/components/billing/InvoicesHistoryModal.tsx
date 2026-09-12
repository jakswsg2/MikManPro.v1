import React, { useState } from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  Printer,
  Download,
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import { LoungeUser, Invoice } from '../../types';
import { InvoiceService } from '../../services/billingEngine';

interface InvoicesHistoryModalProps {
  currentUser: LoungeUser;
  t: (key: string) => string;
  onClose: () => void;
}

export const InvoicesHistoryModal: React.FC<InvoicesHistoryModalProps> = ({
  currentUser,
  t,
  onClose
}) => {
  const [invoices] = useState<Invoice[]>(
    currentUser.is_superuser
      ? InvoiceService.getInvoices()
      : InvoiceService.getUserInvoices(currentUser.id)
  );
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(invoices[0] || null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            مدفوعة (Paid)
          </span>
        );
      case 'ISSUED':
      case 'PENDING':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            بانتظار السداد
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            ملغاة
          </span>
        );
      default:
        return <span className="px-2 py-0.5 text-[10px] text-slate-400">{status}</span>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">سجل الفواتير وسندات القبض</h3>
              <p className="text-xs text-slate-400">
                استعراض وطباعة الفواتير الرسمية وسندات الشحن للاشتراكات
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (List + Printable Receipt preview) */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-y-auto pr-1 flex-1">
          {/* Invoices List */}
          <div className="md:col-span-2 space-y-2">
            <div className="text-xs font-semibold text-slate-400 mb-2">قائمة الفواتير ({invoices.length})</div>
            {invoices.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                لا توجد فواتير مسجلة
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedInvoice?.id === inv.id
                      ? 'bg-slate-800 border-indigo-500 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs font-bold text-white">{inv.invoice_number}</span>
                    {getStatusBadge(inv.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{new Date(inv.issued_at).toLocaleDateString('ar-YE')}</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {inv.total} {inv.currency}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Printable Invoice Receipt View */}
          <div className="md:col-span-3 bg-slate-950 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
            {selectedInvoice ? (
              <div className="space-y-4">
                {/* Official Receipt Header */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      الاستراحة الذكية — SMART LOUNGE
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">سند قبض وفاتورة خدمة</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      رقم الفاتورة: {selectedInvoice.invoice_number}
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center p-1">
                      <QrCode className="w-10 h-10 text-slate-300" />
                    </div>
                    <div className="text-[9px] text-slate-500 text-center mt-1">رمز التحقق LAN</div>
                  </div>
                </div>

                {/* Customer & Date meta */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-400">العميل (User):</span>{' '}
                    <span className="font-bold text-white">{selectedInvoice.user_name || 'ضيف الاستراحة'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">تاريخ الإصدار:</span>{' '}
                    <span className="text-slate-200">{new Date(selectedInvoice.issued_at).toLocaleDateString('ar-YE')}</span>
                  </div>
                  {selectedInvoice.paid_at && (
                    <div>
                      <span className="text-slate-400">تاريخ السداد:</span>{' '}
                      <span className="text-emerald-400">{new Date(selectedInvoice.paid_at).toLocaleDateString('ar-YE')}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">حالة السند:</span> {getStatusBadge(selectedInvoice.status)}
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400">تفاصيل البنود والخدمات:</div>
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="p-2">البند</th>
                          <th className="p-2 text-center">الكمية</th>
                          <th className="p-2 text-left">السعر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {selectedInvoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="p-2 font-medium">{item.description}</td>
                            <td className="p-2 text-center font-mono">{item.quantity}</td>
                            <td className="p-2 text-left font-mono font-bold">
                              {item.total_price} {selectedInvoice.currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Calculation */}
                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono">{selectedInvoice.subtotal} {selectedInvoice.currency}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>الخصم المطبق:</span>
                      <span className="font-mono">-{selectedInvoice.discount} {selectedInvoice.currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-1.5 mt-1">
                    <span>المبلغ الإجمالي النهائي:</span>
                    <span className="text-amber-400 font-mono">{selectedInvoice.total} {selectedInvoice.currency}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-slate-500">
                    مستند إلكتروني صادر من محرك فوترة الاستراحة الذكية
                  </span>
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    طباعة الإيصال (Print)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-12">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                اختر فاتورة من القائمة لاستعراض الإيصال
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
