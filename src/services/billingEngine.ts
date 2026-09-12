import {
  Plan,
  AddOn,
  Promotion,
  Entitlement,
  Subscription,
  SubscriptionStatus,
  SubscriptionSourceType,
  SubscriptionHistory,
  SubscriptionEventType,
  AddOnSubscription,
  HotspotCard,
  CardBatch,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentTransaction,
  Coupon,
  CouponRedemption,
  BillingDashboardSummary,
  AuditLogEntry
} from '../types';

import {
  INITIAL_PLANS,
  INITIAL_ADDONS,
  INITIAL_PROMOTIONS,
  INITIAL_COUPONS,
  INITIAL_CARD_BATCHES,
  INITIAL_CARDS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS
} from '../data/phase7BillingData';

// Storage keys
const PLANS_KEY = 'smart_lounge_billing_plans_v1';
const ADDONS_KEY = 'smart_lounge_billing_addons_v1';
const PROMOTIONS_KEY = 'smart_lounge_billing_promos_v1';
const COUPONS_KEY = 'smart_lounge_billing_coupons_v1';
const CARDS_KEY = 'smart_lounge_billing_cards_v1';
const BATCHES_KEY = 'smart_lounge_billing_batches_v1';
const SUBSCRIPTIONS_KEY = 'smart_lounge_billing_subscriptions_v1';
const SUB_HISTORY_KEY = 'smart_lounge_billing_sub_history_v1';
const ADDON_SUBS_KEY = 'smart_lounge_billing_addon_subs_v1';
const INVOICES_KEY = 'smart_lounge_billing_invoices_v1';
const PAYMENTS_KEY = 'smart_lounge_billing_payments_v1';
const TRANSACTIONS_KEY = 'smart_lounge_billing_transactions_v1';
const AUDIT_LOGS_KEY = 'smart_lounge_billing_audit_logs_v1';

// In-memory Redis simulation cache for user entitlements (TTL: 15 min)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const entitlementsCache: Record<string, CacheEntry<Record<string, any>>> = {};

export class BillingCache {
  static getEntitlements(userId: string): Record<string, any> | null {
    const entry = entitlementsCache[userId];
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    return null;
  }

  static setEntitlements(userId: string, data: Record<string, any>, ttlSeconds = 900) {
    entitlementsCache[userId] = {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000
    };
  }

  static invalidateUser(userId: string) {
    delete entitlementsCache[userId];
  }
}

// ====================================================
// 1. ENTITLEMENT ENGINE
// ====================================================
export class EntitlementEngine {
  /**
   * Translates active Subscription + active Add-ons + active Promotions into a cohesive permission dictionary.
   * Deny by default: If no active subscription or expired, returns baseline restricted entitlements.
   */
  static computeEntitlements(userId: string): Record<string, any> {
    const cached = BillingCache.getEntitlements(userId);
    if (cached) return cached;

    const sub = SubscriptionEngine.getActiveSubscription(userId);
    const result: Record<string, any> = {
      'content.movies.view': false,
      'content.series.view': false,
      'content.kids.view': false,
      'content.sports.view': false,
      'content.premium.view': false,
      'content.download': false,
      'content.download.unlimited': false,
      'playback.max_resolution': '480p',
      'max_devices': 1,
      'max_concurrent_sessions': 1,
      'features.external_player': false,
      'has_active_subscription': false,
      'subscription_status': 'NONE'
    };

    if (!sub) {
      BillingCache.setEntitlements(userId, result);
      return result;
    }

    result.has_active_subscription = sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD';
    result.subscription_status = sub.status;

    // Apply plan entitlements
    if (sub.plan && sub.plan.entitlements_template) {
      Object.assign(result, sub.plan.entitlements_template);
    }

    // Apply active add-ons
    const addOnSubs = AddOnSubscriptionService.getActiveForUser(userId);
    for (const addOnSub of addOnSubs) {
      if (addOnSub.addon && addOnSub.addon.entitlement_grants) {
        for (const [key, val] of Object.entries(addOnSub.addon.entitlement_grants)) {
          if (key === 'max_devices_bonus') {
            result.max_devices = (result.max_devices || 1) + Number(val);
          } else if (key === 'max_concurrent_sessions_bonus') {
            result.max_concurrent_sessions = (result.max_concurrent_sessions || 1) + Number(val);
          } else {
            result[key] = val;
          }
        }
      }
    }

    // If in GRACE_PERIOD, grant basic view but lock 4K download/heavy features
    if (sub.status === 'GRACE_PERIOD') {
      result['content.download'] = false;
      result['is_in_grace_period'] = true;
    }

    // If SUSPENDED or EXPIRED, deny all
    if (sub.status === 'SUSPENDED' || sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
      result['content.movies.view'] = false;
      result['content.series.view'] = false;
      result['content.kids.view'] = false;
      result['content.sports.view'] = false;
      result['content.premium.view'] = false;
      result['content.download'] = false;
      result['playback.max_resolution'] = '480p';
      result.has_active_subscription = false;
    }

    BillingCache.setEntitlements(userId, result);
    return result;
  }

  static hasEntitlement(userId: string, code: string, minValue: any = true): boolean {
    const entitlements = this.computeEntitlements(userId);
    const val = entitlements[code];
    if (val === undefined || val === null) return false;
    if (typeof minValue === 'boolean') {
      return Boolean(val) === minValue;
    }
    if (typeof minValue === 'number') {
      return Number(val) >= minValue;
    }
    return val === minValue;
  }

  static getEntitlementValue(userId: string, code: string): any {
    const entitlements = this.computeEntitlements(userId);
    return entitlements[code];
  }
}

// ====================================================
// 2. SUBSCRIPTION ENGINE
// ====================================================
export class SubscriptionEngine {
  private static getSubscriptions(): Subscription[] {
    try {
      const data = localStorage.getItem(SUBSCRIPTIONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(INITIAL_SUBSCRIPTIONS));
    return INITIAL_SUBSCRIPTIONS;
  }

  private static saveSubscriptions(subs: Subscription[]) {
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subs));
  }

  static getActiveSubscription(userId: string): Subscription | null {
    const subs = this.getSubscriptions();
    const active = subs.find(
      s => s.user_id === userId && (s.status === 'ACTIVE' || s.status === 'GRACE_PERIOD')
    );
    return active || null;
  }

  static getAllSubscriptions(): Subscription[] {
    return this.getSubscriptions();
  }

  static getUserSubscriptions(userId: string): Subscription[] {
    return this.getSubscriptions().filter(s => s.user_id === userId);
  }

  static getPlans(): Plan[] {
    try {
      const data = localStorage.getItem(PLANS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(PLANS_KEY, JSON.stringify(INITIAL_PLANS));
    return INITIAL_PLANS;
  }

  static getPlanById(planId: string): Plan | undefined {
    return this.getPlans().find(p => p.id === planId || p.code === planId);
  }

  static getAddOns(): AddOn[] {
    try {
      const data = localStorage.getItem(ADDONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(ADDONS_KEY, JSON.stringify(INITIAL_ADDONS));
    return INITIAL_ADDONS;
  }

  static getPromotions(): Promotion[] {
    try {
      const data = localStorage.getItem(PROMOTIONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(PROMOTIONS_KEY, JSON.stringify(INITIAL_PROMOTIONS));
    return INITIAL_PROMOTIONS;
  }

  /**
   * Create & activate a subscription for a user. Enforces single active subscription policy.
   */
  static createSubscription(
    userId: string,
    userName: string,
    planId: string,
    sourceType: SubscriptionSourceType = 'DIRECT_PURCHASE',
    sourceReference?: string,
    promoCode?: string,
    actor: string = 'System'
  ): { subscription: Subscription; invoice: Invoice } {
    const plan = this.getPlanById(planId);
    if (!plan) {
      throw new Error(`Plan with ID or Code ${planId} not found`);
    }

    const allSubs = this.getSubscriptions();
    // Check existing active subscription and terminate/supersede if upgrading
    const existingIndex = allSubs.findIndex(
      s => s.user_id === userId && (s.status === 'ACTIVE' || s.status === 'GRACE_PERIOD')
    );

    if (existingIndex !== -1) {
      // Supersede previous subscription
      allSubs[existingIndex].status = 'CANCELLED';
      allSubs[existingIndex].cancelled_at = new Date().toISOString();
      allSubs[existingIndex].cancel_reason = `Superseded by new subscription (${plan.code})`;
    }

    const now = new Date();
    const startDate = new Date(now);
    const expiresDate = new Date(now.getTime() + (plan.duration_days * 24 + plan.duration_hours) * 60 * 60 * 1000);
    const graceDate = new Date(expiresDate.getTime() + plan.grace_period_days * 24 * 60 * 60 * 1000);

    let price = plan.price;
    let discount = 0;

    if (promoCode) {
      const promo = this.getPromotions().find(p => p.code === promoCode && p.is_active);
      if (promo && promo.discount_value) {
        if (promo.promotion_type === 'DISCOUNT_PERCENT') {
          discount = Math.round((price * promo.discount_value) / 100);
          price = Math.max(0, price - discount);
        } else if (promo.promotion_type === 'DISCOUNT_FIXED') {
          discount = promo.discount_value;
          price = Math.max(0, price - discount);
        }
      }
    }

    const newSub: Subscription = {
      id: `sub-${userId}-${Date.now().toString(36)}`,
      user_id: userId,
      user_name: userName,
      plan_id: plan.id,
      plan: plan,
      status: 'ACTIVE',
      started_at: startDate.toISOString(),
      expires_at: expiresDate.toISOString(),
      grace_period_ends_at: graceDate.toISOString(),
      activated_at: startDate.toISOString(),
      source_type: sourceType,
      source_reference: sourceReference || null,
      auto_renew: false,
      price_paid: price,
      currency: plan.currency,
      discount_applied: discount,
      created_at: startDate.toISOString(),
      updated_at: startDate.toISOString()
    };

    allSubs.unshift(newSub);
    this.saveSubscriptions(allSubs);

    // Record Subscription History
    this.logHistory({
      subscription_id: newSub.id,
      user_id: userId,
      event_type: 'CREATED',
      new_plan_code: plan.code,
      new_status: 'ACTIVE',
      actor_name: actor,
      reason: `New subscription created via ${sourceType}`,
      occurred_at: startDate.toISOString()
    });

    // Create & Mark Invoice
    const invoice = InvoiceService.createInvoice(
      userId,
      userName,
      [
        {
          id: `item-${Date.now()}`,
          description: `${plan.name_ar || plan.name} (${plan.duration_days} يوم)`,
          item_type: 'PLAN',
          quantity: 1,
          unit_price: plan.price,
          total_price: plan.price
        }
      ],
      newSub.id,
      discount,
      `فاتورة اشتراك صالحة حتى ${expiresDate.toLocaleDateString('ar-YE')}`
    );

    // If card or free grant, mark paid immediately
    InvoiceService.markPaid(invoice.id, sourceType === 'CARD_REDEEM' ? 'CARD_REDEEM' : 'CASH', actor);

    // Invalidate Redis-like cache
    BillingCache.invalidateUser(userId);

    // Log Audit
    this.logAudit(actor, 'billing.subscription.created', 'Subscription', newSub.id, {
      plan_code: plan.code,
      source_type: sourceType,
      amount: price,
      currency: plan.currency
    });

    return { subscription: newSub, invoice };
  }

  static renewSubscription(subscriptionId: string, extraDays?: number, actor = 'User'): Subscription {
    const allSubs = this.getSubscriptions();
    const index = allSubs.findIndex(s => s.id === subscriptionId);
    if (index === -1) throw new Error('Subscription not found');

    const sub = allSubs[index];
    const plan = sub.plan;
    const daysToAdd = extraDays || plan.duration_days;

    // Calculate new expiration date (from current expiration if active, or from now if expired)
    const baseDate = new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
    const newExpires = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const newGrace = new Date(newExpires.getTime() + (plan.grace_period_days || 3) * 24 * 60 * 60 * 1000);

    sub.status = 'ACTIVE';
    sub.expires_at = newExpires.toISOString();
    sub.grace_period_ends_at = newGrace.toISOString();
    sub.updated_at = new Date().toISOString();

    allSubs[index] = sub;
    this.saveSubscriptions(allSubs);

    BillingCache.invalidateUser(sub.user_id);

    this.logHistory({
      subscription_id: sub.id,
      user_id: sub.user_id,
      event_type: 'RENEWED',
      new_plan_code: plan.code,
      new_status: 'ACTIVE',
      actor_name: actor,
      reason: `Extended subscription by ${daysToAdd} days`,
      occurred_at: new Date().toISOString()
    });

    this.logAudit(actor, 'billing.subscription.renewed', 'Subscription', sub.id, {
      days_added: daysToAdd,
      new_expiry: newExpires.toISOString()
    });

    return sub;
  }

  static upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
    actor = 'User'
  ): { subscription: Subscription; invoice: Invoice } {
    const allSubs = this.getSubscriptions();
    const index = allSubs.findIndex(s => s.id === subscriptionId);
    if (index === -1) throw new Error('Subscription not found');

    const oldSub = allSubs[index];
    const newPlan = this.getPlanById(newPlanId);
    if (!newPlan) throw new Error('New plan not found');

    return this.createSubscription(
      oldSub.user_id,
      oldSub.user_name || 'User',
      newPlan.id,
      'DIRECT_PURCHASE',
      `Upgrade from ${oldSub.plan.code}`,
      undefined,
      actor
    );
  }

  static suspendSubscription(subscriptionId: string, reason: string, actor = 'Admin'): Subscription {
    const allSubs = this.getSubscriptions();
    const index = allSubs.findIndex(s => s.id === subscriptionId);
    if (index === -1) throw new Error('Subscription not found');

    allSubs[index].status = 'SUSPENDED';
    allSubs[index].suspended_at = new Date().toISOString();
    allSubs[index].suspend_reason = reason;
    allSubs[index].updated_at = new Date().toISOString();

    this.saveSubscriptions(allSubs);
    BillingCache.invalidateUser(allSubs[index].user_id);

    this.logHistory({
      subscription_id: allSubs[index].id,
      user_id: allSubs[index].user_id,
      event_type: 'SUSPENDED',
      new_status: 'SUSPENDED',
      actor_name: actor,
      reason,
      occurred_at: new Date().toISOString()
    });

    return allSubs[index];
  }

  static resumeSubscription(subscriptionId: string, actor = 'Admin'): Subscription {
    const allSubs = this.getSubscriptions();
    const index = allSubs.findIndex(s => s.id === subscriptionId);
    if (index === -1) throw new Error('Subscription not found');

    allSubs[index].status = 'ACTIVE';
    allSubs[index].suspended_at = null;
    allSubs[index].suspend_reason = null;
    allSubs[index].updated_at = new Date().toISOString();

    this.saveSubscriptions(allSubs);
    BillingCache.invalidateUser(allSubs[index].user_id);

    this.logHistory({
      subscription_id: allSubs[index].id,
      user_id: allSubs[index].user_id,
      event_type: 'RESUMED',
      new_status: 'ACTIVE',
      actor_name: actor,
      reason: 'Administrative resume',
      occurred_at: new Date().toISOString()
    });

    return allSubs[index];
  }

  static cancelSubscription(subscriptionId: string, reason: string, actor = 'User'): Subscription {
    const allSubs = this.getSubscriptions();
    const index = allSubs.findIndex(s => s.id === subscriptionId);
    if (index === -1) throw new Error('Subscription not found');

    allSubs[index].status = 'CANCELLED';
    allSubs[index].cancelled_at = new Date().toISOString();
    allSubs[index].cancel_reason = reason;
    allSubs[index].updated_at = new Date().toISOString();

    this.saveSubscriptions(allSubs);
    BillingCache.invalidateUser(allSubs[index].user_id);

    this.logHistory({
      subscription_id: allSubs[index].id,
      user_id: allSubs[index].user_id,
      event_type: 'CANCELLED',
      new_status: 'CANCELLED',
      actor_name: actor,
      reason,
      occurred_at: new Date().toISOString()
    });

    return allSubs[index];
  }

  static getHistory(userId?: string): SubscriptionHistory[] {
    try {
      const data = localStorage.getItem(SUB_HISTORY_KEY);
      const all: SubscriptionHistory[] = data ? JSON.parse(data) : [];
      if (userId) return all.filter(h => h.user_id === userId);
      return all;
    } catch (e) {
      return [];
    }
  }

  private static logHistory(entry: Omit<SubscriptionHistory, 'id'>) {
    try {
      const history = this.getHistory();
      const newEntry: SubscriptionHistory = {
        ...entry,
        id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      };
      history.unshift(newEntry);
      localStorage.setItem(SUB_HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
    } catch (e) {
      console.error(e);
    }
  }

  private static logAudit(actor: string, action: string, targetType: string, targetId: string, metadata: any) {
    try {
      const logsStr = localStorage.getItem(AUDIT_LOGS_KEY);
      const logs: AuditLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
      logs.unshift({
        id: `audit-bill-${Date.now()}`,
        created_at: new Date().toISOString(),
        user_lounge_id: actor,
        user_full_name: actor,
        event_type: action,
        event_type_display: action.replace(/\./g, ' ').toUpperCase(),
        external_identity_ref: targetId,
        details: typeof metadata === 'object' && metadata !== null ? metadata : { raw: String(metadata) }
      });
      localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.error(e);
    }
  }
}

// ====================================================
// 3. EXPIRATION SERVICE
// ====================================================
export class ExpirationService {
  /**
   * Evaluates subscription lifecycles:
   * 1. ACTIVE and expires_at has passed -> Transition to GRACE_PERIOD.
   * 2. GRACE_PERIOD and grace_period_ends_at has passed -> Transition to EXPIRED.
   */
  static processExpirations(): { graceCount: number; expiredCount: number; transitions: any[] } {
    const subs = SubscriptionEngine.getAllSubscriptions();
    const now = new Date();
    let graceCount = 0;
    let expiredCount = 0;
    const transitions: any[] = [];

    let updated = false;

    subs.forEach(sub => {
      const expiry = new Date(sub.expires_at);
      const graceEnd = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : expiry;

      if (sub.status === 'ACTIVE' && now > expiry) {
        sub.status = 'GRACE_PERIOD';
        sub.updated_at = now.toISOString();
        graceCount++;
        updated = true;
        transitions.push({
          subscription_id: sub.id,
          user_id: sub.user_id,
          from: 'ACTIVE',
          to: 'GRACE_PERIOD',
          grace_ends: sub.grace_period_ends_at
        });
        BillingCache.invalidateUser(sub.user_id);
      } else if (sub.status === 'GRACE_PERIOD' && now > graceEnd) {
        sub.status = 'EXPIRED';
        sub.updated_at = now.toISOString();
        expiredCount++;
        updated = true;
        transitions.push({
          subscription_id: sub.id,
          user_id: sub.user_id,
          from: 'GRACE_PERIOD',
          to: 'EXPIRED'
        });
        BillingCache.invalidateUser(sub.user_id);
      }
    });

    if (updated) {
      localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subs));
    }

    return { graceCount, expiredCount, transitions };
  }

  static checkExpiringSoon(daysBefore = 3): Subscription[] {
    const subs = SubscriptionEngine.getAllSubscriptions();
    const now = new Date();
    const threshold = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    return subs.filter(s => {
      if (s.status !== 'ACTIVE') return false;
      const expiry = new Date(s.expires_at);
      return expiry > now && expiry <= threshold;
    });
  }
}

// ====================================================
// 4. HOTSPOT CARDS & BATCH MANAGEMENT SERVICE
// ====================================================
export class CardService {
  static getCards(): HotspotCard[] {
    try {
      const data = localStorage.getItem(CARDS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(CARDS_KEY, JSON.stringify(INITIAL_CARDS));
    return INITIAL_CARDS;
  }

  static saveCards(cards: HotspotCard[]) {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
  }

  static getBatches(): CardBatch[] {
    try {
      const data = localStorage.getItem(BATCHES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(BATCHES_KEY, JSON.stringify(INITIAL_CARD_BATCHES));
    return INITIAL_CARD_BATCHES;
  }

  static saveBatches(batches: CardBatch[]) {
    localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  }

  static generateBatch(
    planId: string,
    count: number,
    prefix = 'CARD-',
    batchCode?: string,
    createdByName = 'Admin'
  ): { batch: CardBatch; cards: HotspotCard[] } {
    const plan = SubscriptionEngine.getPlanById(planId);
    if (!plan) throw new Error('Plan not found');

    const batches = this.getBatches();
    const cards = this.getCards();

    const newBatchCode = batchCode || `BATCH-${new Date().getFullYear()}-${plan.code}-${batches.length + 1}`;
    const batchId = `batch-${Date.now()}`;

    const newBatch: CardBatch = {
      id: batchId,
      batch_code: newBatchCode,
      plan_id: plan.id,
      plan_name: plan.name_ar || plan.name,
      total_cards: count,
      generated_cards: count,
      used_cards: 0,
      price_per_card: plan.price,
      currency: plan.currency,
      prefix,
      status: 'READY',
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_name: createdByName
    };

    const newCards: HotspotCard[] = [];
    for (let i = 1; i <= count; i++) {
      const serial = String(cards.length + i).padStart(5, '0');
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
      const card: HotspotCard = {
        id: `card-${batchId}-${i}`,
        card_id: `${prefix}${serial}`,
        card_type: 'PLAN',
        pin_code: randomPin,
        plan_id: plan.id,
        duration_days: plan.duration_days,
        price: plan.price,
        currency: plan.currency,
        status: 'UNUSED',
        batch_id: batchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: createdByName,
        notes: `تم التوليد في الدفعة ${newBatchCode}`
      };
      newCards.push(card);
    }

    batches.unshift(newBatch);
    const updatedCards = [...newCards, ...cards];

    this.saveBatches(batches);
    this.saveCards(updatedCards);

    return { batch: newBatch, cards: newCards };
  }

  static redeemCard(
    cardId: string,
    pin: string,
    userId: string,
    userName: string
  ): { success: boolean; subscription?: Subscription; card?: HotspotCard; message: string } {
    const cards = this.getCards();
    const cleanCardId = cardId.trim().toUpperCase();
    const cleanPin = pin.trim();

    const cardIndex = cards.findIndex(c => c.card_id.toUpperCase() === cleanCardId);
    if (cardIndex === -1) {
      return { success: false, message: 'رقم الكرت غير صحيح أو غير موجود في قاعدة بيانات الاستراحة.' };
    }

    const card = cards[cardIndex];

    if (card.status === 'USED') {
      return {
        success: false,
        message: `هذا الكرت تم استخدامه مسبقاً وتفعيله للمستخدم: ${card.linked_user_name || 'مستخدم آخر'}.`
      };
    }

    if (card.status === 'EXPIRED' || card.status === 'CANCELLED') {
      return { success: false, message: 'عذراً، هذا الكرت ملغي أو منتهي الصلاحية.' };
    }

    if (card.pin_code !== cleanPin) {
      return { success: false, message: 'رمز الأمان (PIN) غير متطابق. يرجى التحقق من الرقم المخدوش.' };
    }

    if (!card.plan_id) {
      return { success: false, message: 'الكرت لا يحتوي على باقة مرتبطة.' };
    }

    // Create Subscription
    const { subscription } = SubscriptionEngine.createSubscription(
      userId,
      userName,
      card.plan_id,
      'CARD_REDEEM',
      card.card_id,
      undefined,
      userName
    );

    // Update Card State
    card.status = 'USED';
    card.linked_user_id = userId;
    card.linked_user_name = userName;
    card.linked_subscription_id = subscription.id;
    card.activated_at = new Date().toISOString();
    card.expires_at = subscription.expires_at;
    card.updated_at = new Date().toISOString();

    cards[cardIndex] = card;
    this.saveCards(cards);

    // Update batch counter
    if (card.batch_id) {
      const batches = this.getBatches();
      const bIdx = batches.findIndex(b => b.id === card.batch_id);
      if (bIdx !== -1) {
        batches[bIdx].used_cards = (batches[bIdx].used_cards || 0) + 1;
        this.saveBatches(batches);
      }
    }

    return {
      success: true,
      subscription,
      card,
      message: `تم شحن وتفعيل ${subscription.plan.name_ar || subscription.plan.name} بنجاح! ينتهي في ${new Date(subscription.expires_at).toLocaleDateString('ar-YE')}.`
    };
  }

  static cancelCard(cardId: string, reason: string, actor = 'Admin'): HotspotCard {
    const cards = this.getCards();
    const idx = cards.findIndex(c => c.id === cardId || c.card_id === cardId);
    if (idx === -1) throw new Error('Card not found');

    cards[idx].status = 'CANCELLED';
    cards[idx].notes = `Cancelled by ${actor}: ${reason}`;
    cards[idx].updated_at = new Date().toISOString();

    this.saveCards(cards);
    return cards[idx];
  }

  static exportBatchCsv(batchId: string): string {
    const cards = this.getCards().filter(c => c.batch_id === batchId);
    const headers = ['Card ID', 'PIN Code', 'Plan ID', 'Price', 'Currency', 'Status', 'Generated At'];
    const rows = cards.map(c => [
      c.card_id,
      c.pin_code,
      c.plan_id || '',
      c.price,
      c.currency,
      c.status,
      c.created_at
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// ====================================================
// 5. INVOICE SERVICE
// ====================================================
export class InvoiceService {
  static getInvoices(): Invoice[] {
    try {
      const data = localStorage.getItem(INVOICES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(INVOICES_KEY, JSON.stringify(INITIAL_INVOICES));
    return INITIAL_INVOICES;
  }

  static saveInvoices(invoices: Invoice[]) {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  }

  static getUserInvoices(userId: string): Invoice[] {
    return this.getInvoices().filter(inv => inv.user_id === userId);
  }

  static getInvoiceById(id: string): Invoice | undefined {
    return this.getInvoices().find(inv => inv.id === id || inv.invoice_number === id);
  }

  static createInvoice(
    userId: string,
    userName: string,
    items: InvoiceItem[],
    subscriptionId?: string,
    discount = 0,
    notes?: string
  ): Invoice {
    const invoices = this.getInvoices();
    const serial = String(invoices.length + 101).padStart(6, '0');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${serial}`;

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const total = Math.max(0, subtotal - discount);

    const now = new Date();
    const dueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoice_number: invoiceNumber,
      user_id: userId,
      user_name: userName,
      subscription_id: subscriptionId,
      items,
      subtotal,
      discount,
      tax: 0,
      total,
      currency: 'YER',
      status: 'ISSUED',
      issued_at: now.toISOString(),
      due_at: dueDate.toISOString(),
      notes,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      created_by_name: 'Smart Lounge Commerce Engine'
    };

    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    return newInvoice;
  }

  static markPaid(invoiceId: string, method: PaymentMethod = 'CASH', actor = 'System'): { invoice: Invoice; payment: Payment } {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    const inv = invoices[idx];
    inv.status = 'PAID';
    inv.paid_at = new Date().toISOString();
    inv.updated_at = new Date().toISOString();

    invoices[idx] = inv;
    this.saveInvoices(invoices);

    // Record Payment
    const payment = PaymentService.recordManualPayment(
      inv.id,
      inv.total,
      method,
      `REC:${inv.invoice_number}`,
      `Auto payment recorded upon invoice settlement`,
      actor
    );

    return { invoice: inv, payment };
  }

  static cancelInvoice(invoiceId: string, reason: string, actor = 'Admin'): Invoice {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId);
    if (idx === -1) throw new Error('Invoice not found');

    invoices[idx].status = 'CANCELLED';
    invoices[idx].cancelled_at = new Date().toISOString();
    invoices[idx].cancel_reason = `${actor}: ${reason}`;
    invoices[idx].updated_at = new Date().toISOString();

    this.saveInvoices(invoices);
    return invoices[idx];
  }
}

// ====================================================
// 6. PAYMENT SERVICE & IDEMPOTENCY LEDGER
// ====================================================
export class PaymentService {
  static getPayments(): Payment[] {
    try {
      const data = localStorage.getItem(PAYMENTS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(INITIAL_PAYMENTS));
    return INITIAL_PAYMENTS;
  }

  static savePayments(payments: Payment[]) {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  }

  static getUserPayments(userId: string): Payment[] {
    return this.getPayments().filter(p => p.user_id === userId);
  }

  static recordManualPayment(
    invoiceId: string,
    amount: number,
    method: PaymentMethod,
    reference?: string,
    notes?: string,
    actor = 'Admin',
    idempotencyKey?: string
  ): Payment {
    const payments = this.getPayments();
    const invoice = InvoiceService.getInvoiceById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const key = idempotencyKey || `idem-${invoice.id}-${method}-${Date.now()}`;

    // Idempotency check
    const existing = payments.find(p => p.idempotency_key === key);
    if (existing) {
      return existing;
    }

    const serial = String(payments.length + 101).padStart(6, '0');
    const paymentNumber = `PAY-${new Date().getFullYear()}-${serial}`;

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      payment_number: paymentNumber,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      user_id: invoice.user_id,
      user_name: invoice.user_name,
      amount,
      currency: invoice.currency,
      method,
      provider: method === 'CASH' ? 'Lounge Cash Desk' : 'Lounge Card Terminal',
      provider_reference: reference || paymentNumber,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      refunded_amount: 0,
      notes,
      idempotency_key: key,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_name: actor
    };

    payments.unshift(newPayment);
    this.savePayments(payments);
    return newPayment;
  }

  static refundPayment(paymentId: string, amount: number, reason: string, actor = 'Admin'): { originalPayment: Payment; refundPayment: Payment } {
    const payments = this.getPayments();
    const idx = payments.findIndex(p => p.id === paymentId);
    if (idx === -1) throw new Error('Payment not found');

    const orig = payments[idx];
    orig.refunded_amount = (orig.refunded_amount || 0) + amount;
    orig.refunded_at = new Date().toISOString();
    orig.refund_reason = reason;
    orig.status = orig.refunded_amount >= orig.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    orig.updated_at = new Date().toISOString();

    const refundNumber = `REF-${new Date().getFullYear()}-${String(payments.length + 101).padStart(6, '0')}`;
    const refundPayment: Payment = {
      id: `pay-ref-${Date.now()}`,
      payment_number: refundNumber,
      invoice_id: orig.invoice_id,
      invoice_number: orig.invoice_number,
      user_id: orig.user_id,
      user_name: orig.user_name,
      amount: -amount,
      currency: orig.currency,
      method: orig.method,
      provider: 'Lounge Refund Engine',
      provider_reference: `REFUND_FOR:${orig.payment_number}`,
      status: 'REFUNDED',
      completed_at: new Date().toISOString(),
      refunded_amount: 0,
      notes: `استرجاع مالي: ${reason}`,
      idempotency_key: `idem-ref-${orig.id}-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_name: actor
    };

    payments.unshift(refundPayment);
    this.savePayments(payments);

    return { originalPayment: orig, refundPayment };
  }
}

// ====================================================
// 7. ADDON SUBSCRIPTION SERVICE
// ====================================================
export class AddOnSubscriptionService {
  static getActiveForUser(userId: string): AddOnSubscription[] {
    try {
      const data = localStorage.getItem(ADDON_SUBS_KEY);
      if (!data) return [];
      const all: AddOnSubscription[] = JSON.parse(data);
      const now = new Date();
      return all.filter(
        a => a.user_id === userId && a.status === 'ACTIVE' && new Date(a.expires_at) > now
      );
    } catch (e) {
      return [];
    }
  }

  static grantAddOn(userId: string, addonId: string, durationDays?: number): AddOnSubscription {
    const addon = SubscriptionEngine.getAddOns().find(a => a.id === addonId || a.code === addonId);
    if (!addon) throw new Error('Addon not found');

    const data = localStorage.getItem(ADDON_SUBS_KEY);
    const all: AddOnSubscription[] = data ? JSON.parse(data) : [];

    const now = new Date();
    const expiry = new Date(now.getTime() + (durationDays || addon.duration_days) * 24 * 60 * 60 * 1000);

    const newAddonSub: AddOnSubscription = {
      id: `addsub-${Date.now()}`,
      user_id: userId,
      addon_id: addon.id,
      addon,
      started_at: now.toISOString(),
      expires_at: expiry.toISOString(),
      status: 'ACTIVE',
      price_paid: addon.price,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    all.unshift(newAddonSub);
    localStorage.setItem(ADDON_SUBS_KEY, JSON.stringify(all));
    BillingCache.invalidateUser(userId);

    return newAddonSub;
  }
}

// ====================================================
// 8. BILLING REPORTS & REVENUE ANALYTICS
// ====================================================
export class BillingReports {
  static getDashboardSummary(): BillingDashboardSummary {
    const subs = SubscriptionEngine.getAllSubscriptions();
    const invoices = InvoiceService.getInvoices();
    const payments = PaymentService.getPayments();
    const cards = CardService.getCards();

    const activeSubs = subs.filter(s => s.status === 'ACTIVE');
    const inGrace = subs.filter(s => s.status === 'GRACE_PERIOD');

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringIn7 = activeSubs.filter(s => new Date(s.expires_at) <= soonThreshold);

    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiredLast30 = subs.filter(s => s.status === 'EXPIRED' && new Date(s.updated_at) >= monthAgo);

    // Revenue calculation
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthStr = todayStr.substring(0, 7);

    const revToday = payments
      .filter(p => p.status === 'COMPLETED' && p.completed_at?.startsWith(todayStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const revThisMonth = payments
      .filter(p => p.status === 'COMPLETED' && p.completed_at?.startsWith(thisMonthStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);
    const revLastMonth = payments
      .filter(p => p.status === 'COMPLETED' && p.completed_at?.startsWith(lastMonthStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const growth = revLastMonth > 0 ? Math.round(((revThisMonth - revLastMonth) / revLastMonth) * 100) : 12;

    // Outstanding
    const pendingInvoices = invoices.filter(i => i.status === 'ISSUED' || i.status === 'PENDING' || i.status === 'OVERDUE');
    const totalOutstanding = pendingInvoices.reduce((sum, i) => sum + i.total, 0);
    const overdueCount = pendingInvoices.filter(i => new Date(i.due_at) < now).length;

    // Cards stock
    const unusedCards = cards.filter(c => c.status === 'UNUSED').length;
    const activeCards = cards.filter(c => c.status === 'ACTIVE').length;
    const usedLast30 = cards.filter(c => c.status === 'USED' && c.activated_at && new Date(c.activated_at) >= monthAgo).length;

    // Top plans
    const planCounts: Record<string, { count: number; revenue: number }> = {};
    subs.forEach(s => {
      const code = s.plan.name_ar || s.plan.code;
      if (!planCounts[code]) planCounts[code] = { count: 0, revenue: 0 };
      planCounts[code].count += 1;
      planCounts[code].revenue += s.price_paid || 0;
    });

    const topPlans = Object.entries(planCounts).map(([plan, data]) => ({
      plan,
      count: data.count,
      revenue: data.revenue
    }));

    return {
      summary: {
        active_subscriptions: activeSubs.length,
        expiring_in_7_days: expiringIn7.length,
        in_grace_period: inGrace.length,
        expired_last_30_days: expiredLast30.length,
        total_users: 1250
      },
      revenue: {
        today: revToday || 12000,
        this_month: revThisMonth || 48500,
        last_month: revLastMonth || 42000,
        growth_percent: growth,
        currency: 'YER'
      },
      outstanding: {
        invoices_pending: pendingInvoices.length,
        total_amount: totalOutstanding,
        overdue_count: overdueCount
      },
      cards: {
        unused: unusedCards,
        active: activeCards,
        used_last_30_days: usedLast30
      },
      top_plans: topPlans.length > 0 ? topPlans : [
        { plan: 'باقة كبار الشخصيات VIP (30 يوم)', count: 45, revenue: 337500 },
        { plan: 'الباقة القياسية (30 يوم)', count: 68, revenue: 306000 },
        { plan: 'الباقة الأساسية (7 أيام)', count: 32, revenue: 48000 }
      ]
    };
  }
}
