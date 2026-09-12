import React, { useState } from 'react';
import { LoungeUser, Plan } from '../../types';
import { Translations } from '../../lib/i18n';
import { SubscriptionOverview } from '../billing/SubscriptionOverview';
import { PlansBrowser } from '../billing/PlansBrowser';
import { RedeemCardModal } from '../billing/RedeemCardModal';
import { InvoicesHistoryModal } from '../billing/InvoicesHistoryModal';

interface BillingViewProps {
  currentUser: LoungeUser;
  t: Translations;
  onUpgradeToVIP?: () => void;
}

export const BillingView: React.FC<BillingViewProps> = ({
  currentUser,
  t,
  onUpgradeToVIP
}) => {
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
  const [selectedPlanForRedeem, setSelectedPlanForRedeem] = useState<Plan | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenRedeemWithPlan = (plan: Plan) => {
    setSelectedPlanForRedeem(plan);
    setIsRedeemModalOpen(true);
  };

  return (
    <div key={refreshKey} className="space-y-8 animate-fade-in pb-12">
      {/* Top Section: Active Subscription Status & Countdown */}
      <SubscriptionOverview
        currentUser={currentUser}
        t={(k) => (t as any)[k] || k}
        onOpenPlans={() => {
          const plansEl = document.getElementById('plans-browser-section');
          if (plansEl) plansEl.scrollIntoView({ behavior: 'smooth' });
        }}
        onOpenRedeem={() => {
          setSelectedPlanForRedeem(null);
          setIsRedeemModalOpen(true);
        }}
        onOpenInvoices={() => setIsInvoicesModalOpen(true)}
      />

      {/* Plans & Add-ons Marketplace Section */}
      <div id="plans-browser-section" className="space-y-4">
        <div className="border-t border-slate-800/80 pt-6">
          <h3 className="text-xl font-bold text-white mb-1">
            الباقات المتاحة والإضافات (Subscription Tiers & Add-ons)
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            اختر الباقة المناسبة لاحتياجاتك، استمتع بمدة أطول، جودة 4K، وشاهد أحدث الأفلام والمسلسلات بدون استهلاك باقة الإنترنت
          </p>

          <PlansBrowser
            currentUser={currentUser}
            t={(k) => (t as any)[k] || k}
            onSelectPlanForRedeem={handleOpenRedeemWithPlan}
            onSuccess={handleRefresh}
          />
        </div>
      </div>

      {/* Redeem Hotspot Card Modal */}
      {isRedeemModalOpen && (
        <RedeemCardModal
          currentUser={currentUser}
          t={(k) => (t as any)[k] || k}
          defaultPlan={selectedPlanForRedeem}
          onClose={() => {
            setIsRedeemModalOpen(false);
            setSelectedPlanForRedeem(null);
          }}
          onSuccess={() => {
            handleRefresh();
          }}
        />
      )}

      {/* Invoices History Modal */}
      {isInvoicesModalOpen && (
        <InvoicesHistoryModal
          currentUser={currentUser}
          t={(k) => (t as any)[k] || k}
          onClose={() => setIsInvoicesModalOpen(false)}
        />
      )}
    </div>
  );
};
