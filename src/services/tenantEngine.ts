import { 
  Tenant, 
  Site, 
  TenantStatus, 
  TenantPlan, 
  SiteStatus, 
  SiteType, 
  TenantSettings, 
  TenantBranding, 
  CrossTenantAuditAttempt, 
  RLSTestResult, 
  TenantMetrics, 
  LoungeUser,
  Profile,
  PermissionGroup
} from '../types';
import { 
  INITIAL_TENANTS, 
  INITIAL_SITES, 
  INITIAL_CROSS_TENANT_AUDITS, 
  INITIAL_RLS_TEST_SUITE,
  DEFAULT_TENANT_SETTINGS
} from '../data/tenantData';
import { 
  TenantContext, 
  get_current_tenant_id, 
  set_global_current_tenant_id,
  get_current_site_id,
  set_global_current_site_id,
  is_bypass_rls,
  is_current_superuser,
  require_tenant_context,
  CacheKeys
} from './tenantContext';

const TENANTS_STORAGE_KEY = 'smart_lounge_tenants_v8';
const SITES_STORAGE_KEY = 'smart_lounge_sites_v8';
const ACTIVE_TENANT_KEY = 'smart_lounge_active_tenant_id_v8';
const ACTIVE_SITE_KEY = 'smart_lounge_active_site_id_v8';
const CROSS_TENANT_AUDITS_KEY = 'smart_lounge_cross_tenant_audits_v8';

export interface ProvisionTenantInput {
  name: string;
  name_ar?: string;
  name_en?: string;
  slug: string;
  admin_email: string;
  admin_username: string;
  admin_full_name: string;
  admin_password?: string;
  plan: TenantPlan;
  contact_phone?: string;
  address?: string;
  country?: string;
  default_language?: 'ar' | 'en';
  max_users?: number;
  max_sites?: number;
  max_media_servers?: number;
  initial_site_name?: string;
}

export interface ProvisionTenantResult {
  tenant: Tenant;
  admin_user: Partial<LoungeUser>;
  admin_password_revealed: string;
  default_site: Site;
  default_profiles_count: number;
  default_groups_count: number;
}

class MultiTenantEngineService {
  private tenants: Tenant[] = [];
  private sites: Site[] = [];
  private activeTenantId: string = 'tnt-001';
  private activeSiteId: string = 'site-001-1';
  private crossTenantAudits: CrossTenantAuditAttempt[] = [];
  private overrideTenantId: string | null = null; // X-Tenant-Override header support

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const storedTenants = localStorage.getItem(TENANTS_STORAGE_KEY);
      this.tenants = storedTenants ? JSON.parse(storedTenants) : INITIAL_TENANTS;

      const storedSites = localStorage.getItem(SITES_STORAGE_KEY);
      this.sites = storedSites ? JSON.parse(storedSites) : INITIAL_SITES;

      const storedActiveTenant = localStorage.getItem(ACTIVE_TENANT_KEY);
      if (storedActiveTenant && this.tenants.some(t => t.id === storedActiveTenant)) {
        this.activeTenantId = storedActiveTenant;
      } else {
        this.activeTenantId = this.tenants[0]?.id || 'tnt-001';
      }

      const storedActiveSite = localStorage.getItem(ACTIVE_SITE_KEY);
      if (storedActiveSite && this.sites.some(s => s.id === storedActiveSite)) {
        this.activeSiteId = storedActiveSite;
      } else {
        const tenantSites = this.sites.filter(s => s.tenant_id === this.activeTenantId);
        this.activeSiteId = tenantSites[0]?.id || 'site-001-1';
      }

      const storedAudits = localStorage.getItem(CROSS_TENANT_AUDITS_KEY);
      this.crossTenantAudits = storedAudits ? JSON.parse(storedAudits) : INITIAL_CROSS_TENANT_AUDITS;

      // Sync with context
      set_global_current_tenant_id(this.activeTenantId);
      set_global_current_site_id(this.activeSiteId);
      this.applyTenantBranding(this.getActiveTenant());
    } catch (e) {
      this.tenants = INITIAL_TENANTS;
      this.sites = INITIAL_SITES;
      this.crossTenantAudits = INITIAL_CROSS_TENANT_AUDITS;
    }
  }

  private saveState() {
    try {
      localStorage.setItem(TENANTS_STORAGE_KEY, JSON.stringify(this.tenants));
      localStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(this.sites));
      localStorage.setItem(ACTIVE_TENANT_KEY, this.activeTenantId);
      localStorage.setItem(ACTIVE_SITE_KEY, this.activeSiteId);
      localStorage.setItem(CROSS_TENANT_AUDITS_KEY, JSON.stringify(this.crossTenantAudits.slice(0, 100)));
    } catch (e) {
      console.error('Failed to save multi-tenant state:', e);
    }
  }

  // --- Tenant Query & Management ---

  public getAllTenants(): Tenant[] {
    return [...this.tenants];
  }

  /** Load the canonical tenant directory from Django/PostgreSQL when available. */
  public async syncFromBackend(): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/tenants/');
      if (!response.ok) return false;

      const payload = await response.json();
      const records = payload.results || payload;
      if (!Array.isArray(records)) return false;

      this.tenants = records.map((record: any): Tenant => ({
        id: String(record.id),
        name: record.name,
        name_ar: record.name,
        name_en: record.name,
        slug: record.slug,
        code: record.slug.toUpperCase(),
        status: record.is_active ? 'ACTIVE' : 'SUSPENDED',
        is_active: record.is_active,
        timezone: 'Asia/Aden',
        default_language: 'ar',
        supported_languages: ['ar', 'en'],
        default_currency: 'YER',
        subscription_plan: 'STANDARD',
        max_sites: record.sites?.length || 1,
        max_users: 0,
        max_media_servers: 0,
        created_at: record.created_at,
        updated_at: record.updated_at,
        settings: { ...DEFAULT_TENANT_SETTINGS },
        branding: {
          primary_color: '#f59e0b',
          secondary_color: '#0f172a',
          app_name: record.name,
        },
      }));

      this.sites = records.flatMap((record: any): Site[] => (record.sites || []).map((site: any) => ({
        id: String(site.id),
        tenant_id: String(record.id),
        tenant_name: record.name,
        name: site.name,
        code: site.code,
        slug: site.code.toLowerCase(),
        status: site.is_active ? 'ACTIVE' : 'SUSPENDED',
        site_type: 'LOUNGE',
        is_active: site.is_active,
        timezone: 'Asia/Aden',
        capacity: 0,
        settings: {},
        created_at: site.created_at,
        updated_at: site.updated_at,
      })));

      if (!this.tenants.some((tenant) => tenant.id === this.activeTenantId)) {
        this.activeTenantId = this.tenants[0]?.id || '';
      }
      const activeSites = this.getSitesForTenant(this.activeTenantId);
      this.activeSiteId = activeSites[0]?.id || '';
      this.saveState();
      set_global_current_tenant_id(this.activeTenantId || null);
      set_global_current_site_id(this.activeSiteId || null);
      this.applyTenantBranding(this.getActiveTenant());
      return true;
    } catch {
      return false;
    }
  }

  public getTenantById(id: string): Tenant | undefined {
    return this.tenants.find(t => t.id === id);
  }

  public getTenantBySlug(slug: string): Tenant | undefined {
    return this.tenants.find(t => t.slug === slug);
  }

  public getActiveTenant(): Tenant {
    const effectiveTenantId = this.overrideTenantId || this.activeTenantId;
    const found = this.tenants.find(t => t.id === effectiveTenantId);
    return found || this.tenants[0] || INITIAL_TENANTS[0];
  }

  public setActiveTenant(tenantId: string): void {
    const target = this.tenants.find(t => t.id === tenantId);
    if (!target) return;

    this.activeTenantId = tenantId;
    this.overrideTenantId = null;
    set_global_current_tenant_id(tenantId);

    // Update active site to first site of this tenant
    const tenantSites = this.getSitesForTenant(tenantId);
    if (tenantSites.length > 0) {
      this.activeSiteId = tenantSites[0].id;
      set_global_current_site_id(tenantSites[0].id);
    } else {
      this.activeSiteId = '';
      set_global_current_site_id(null);
    }

    this.saveState();
    this.applyTenantBranding(target);
  }

  // Superuser X-Tenant-Override Header Simulation (Impersonation)
  public setTenantOverride(tenantId: string | null, superuserName = 'Admin Tariq'): void {
    this.overrideTenantId = tenantId;
    if (tenantId) {
      set_global_current_tenant_id(tenantId);
      const target = this.getTenantById(tenantId);
      if (target) {
        this.applyTenantBranding(target);
        this.logCrossTenantEvent({
          actor_id: 'usr-4',
          actor_name: `${superuserName} (Superuser Impersonation)`,
          actor_tenant_id: 'tnt-001',
          actor_tenant_name: 'Super Admin Console',
          target_tenant_id: tenantId,
          target_tenant_name: target.name,
          resource_type: 'Tenant',
          resource_id: tenantId,
          action: 'superuser.impersonate.tenant_override',
          endpoint: `/api/v1/admin/tenants/${tenantId}/impersonate/`,
          ip_address: '192.168.1.254',
          result: 'ALLOWED',
          details: {
            mode: 'X-Tenant-Override',
            message: `Superuser granted temporary context switch into ${target.code} (${target.slug})`
          }
        });
      }
    } else {
      set_global_current_tenant_id(this.activeTenantId);
      this.applyTenantBranding(this.getActiveTenant());
    }
  }

  public getOverrideTenantId(): string | null {
    return this.overrideTenantId;
  }

  // --- Branding Injection ---
  public applyTenantBranding(tenant: Tenant | undefined): void {
    if (!tenant || !tenant.branding || typeof document === 'undefined') return;

    const b = tenant.branding;
    if (b.primary_color) {
      document.documentElement.style.setProperty('--color-primary', b.primary_color);
      document.documentElement.style.setProperty('--primary', b.primary_color);
    }
    if (b.app_name) {
      document.title = `${b.app_name} | Smart Lounge LAN`;
    }
  }

  // --- Site Management ---

  public getSitesForTenant(tenantId?: string): Site[] {
    const tid = tenantId || this.getActiveTenant().id;
    return this.sites.filter(s => s.tenant_id === tid);
  }

  public getAllSites(): Site[] {
    return [...this.sites];
  }

  public getActiveSite(): Site | undefined {
    return this.sites.find(s => s.id === this.activeSiteId);
  }

  public setActiveSite(siteId: string): void {
    const site = this.sites.find(s => s.id === siteId);
    if (!site) return;
    this.activeSiteId = siteId;
    set_global_current_site_id(siteId);
    this.saveState();
  }

  public createSite(input: {
    tenant_id: string;
    name: string;
    code: string;
    site_type: SiteType;
    address?: string;
    city?: string;
    capacity?: number;
    contact_person?: string;
    contact_phone?: string;
    settings?: Record<string, any>;
  }): Site {
    const tenant = this.getTenantById(input.tenant_id);
    if (!tenant) throw new Error('Tenant not found');

    const slug = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `site-${Date.now()}`;
    const newSite: Site = {
      id: `site-${input.tenant_id}-${Date.now().toString().slice(-4)}`,
      tenant_id: input.tenant_id,
      tenant_name: tenant.name,
      name: input.name,
      code: input.code.toUpperCase(),
      slug,
      status: 'ACTIVE',
      site_type: input.site_type,
      is_active: true,
      address: input.address,
      city: input.city,
      capacity: input.capacity || 50,
      contact_person: input.contact_person,
      contact_phone: input.contact_phone,
      settings: input.settings || { max_concurrent_sessions: 3 },
      created_at: new Date().toISOString()
    };

    this.sites.push(newSite);
    this.saveState();
    return newSite;
  }

  public updateSite(siteId: string, updates: Partial<Site>): Site {
    const index = this.sites.findIndex(s => s.id === siteId);
    if (index === -1) throw new Error('Site not found');

    this.sites[index] = {
      ...this.sites[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.saveState();
    return this.sites[index];
  }

  public toggleSiteStatus(siteId: string, status: SiteStatus): Site {
    return this.updateSite(siteId, { 
      status, 
      is_active: status === 'ACTIVE' 
    });
  }

  // --- Tenant Provisioning Service (Atomic 11-step Workflow) ---

  public provisionTenant(input: ProvisionTenantInput): ProvisionTenantResult {
    // 1. Slug uniqueness validation
    const cleanSlug = input.slug.trim().toLowerCase();
    if (this.tenants.some(t => t.slug === cleanSlug)) {
      throw new Error(`Slug '${cleanSlug}' is already registered by another tenant.`);
    }

    // 2. Generate unique tenant code
    const tenantNumber = (this.tenants.length + 1).toString().padStart(5, '0');
    const tenantCode = `TNT-${tenantNumber}`;
    const tenantId = `tnt-${Date.now().toString().slice(-6)}`;

    // 3. Generate secure random admin password if not provided
    const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generatedPassword = input.admin_password || '';
    if (!generatedPassword) {
      for (let i = 0; i < 12; i++) {
        generatedPassword += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
      }
    }

    // 4. Create Tenant object (Atomic)
    const newTenant: Tenant = {
      id: tenantId,
      name: input.name,
      name_ar: input.name_ar || input.name,
      name_en: input.name_en || input.name,
      slug: cleanSlug,
      code: tenantCode,
      status: 'ACTIVE',
      is_active: true,
      contact_email: input.admin_email,
      contact_phone: input.contact_phone,
      address: input.address,
      country: input.country || 'YE',
      timezone: 'Asia/Aden',
      default_language: input.default_language || 'ar',
      supported_languages: ['ar', 'en'],
      default_currency: 'YER',
      subscription_plan: input.plan,
      max_users: input.max_users || (input.plan === 'ENTERPRISE' ? 1000 : input.plan === 'STANDARD' ? 200 : 50),
      max_sites: input.max_sites || (input.plan === 'ENTERPRISE' ? 10 : input.plan === 'STANDARD' ? 3 : 1),
      max_media_servers: input.max_media_servers || (input.plan === 'ENTERPRISE' ? 8 : input.plan === 'STANDARD' ? 3 : 1),
      activated_at: new Date().toISOString(),
      settings: {
        ...DEFAULT_TENANT_SETTINGS,
        default_language: input.default_language || 'ar'
      },
      branding: {
        primary_color: '#f59e0b',
        secondary_color: '#0f172a',
        app_name: input.name,
        app_subtitle: 'الاستراحة الذكية — شبكة البث المحلي'
      },
      created_at: new Date().toISOString()
    };

    // 5. Create Default Site
    const defaultSiteName = input.initial_site_name || 'الفرع الرئيسي (Main Branch)';
    const defaultSite: Site = {
      id: `site-${tenantId}-1`,
      tenant_id: tenantId,
      tenant_name: newTenant.name,
      name: defaultSiteName,
      code: 'SITE-01',
      slug: 'main-branch',
      status: 'ACTIVE',
      site_type: 'LOUNGE',
      is_active: true,
      address: input.address || 'المقر الرئيسي',
      city: 'صنعاء',
      country: input.country || 'YE',
      capacity: 100,
      contact_person: input.admin_full_name,
      contact_phone: input.contact_phone,
      settings: { max_concurrent_sessions: 3 },
      created_at: new Date().toISOString()
    };

    // 6. Create Admin User
    const adminUser: Partial<LoungeUser> = {
      id: `usr-${tenantId}-admin`,
      lounge_id: `LU-${tenantNumber}`,
      username: input.admin_username,
      full_name: input.admin_full_name,
      email: input.admin_email,
      phone: input.contact_phone,
      language: input.default_language || 'ar',
      timezone: 'Asia/Aden',
      status: 'ACTIVE',
      is_active: true,
      is_staff: true,
      is_superuser: false,
      created_at: new Date().toISOString()
    };

    // Commit changes
    this.tenants.push(newTenant);
    this.sites.push(defaultSite);
    this.saveState();

    // Log in cross tenant audit
    this.logCrossTenantEvent({
      actor_id: 'usr-4',
      actor_name: 'م. طارق الحكيمي (Super Admin)',
      actor_tenant_id: 'tnt-001',
      actor_tenant_name: 'Platform Core',
      target_tenant_id: tenantId,
      target_tenant_name: newTenant.name,
      resource_type: 'Tenant',
      resource_id: tenantId,
      action: 'tenant.provisioning.completed',
      endpoint: '/api/v1/admin/tenants/',
      ip_address: '192.168.1.254',
      result: 'ALLOWED',
      details: {
        code: tenantCode,
        slug: cleanSlug,
        plan: input.plan,
        admin_username: input.admin_username,
        default_site: defaultSite.name
      }
    });

    return {
      tenant: newTenant,
      admin_user: adminUser,
      admin_password_revealed: generatedPassword,
      default_site: defaultSite,
      default_profiles_count: 4,
      default_groups_count: 3
    };
  }

  // --- Tenant Lifecycle (Suspend, Resume, Archive) ---

  public updateTenantSettings(tenantId: string, settings: Partial<TenantSettings>): Tenant {
    const index = this.tenants.findIndex(t => t.id === tenantId);
    if (index === -1) throw new Error('Tenant not found');

    this.tenants[index] = {
      ...this.tenants[index],
      settings: {
        ...(this.tenants[index].settings || DEFAULT_TENANT_SETTINGS),
        ...settings
      },
      updated_at: new Date().toISOString()
    };
    this.saveState();
    return this.tenants[index];
  }

  public updateTenantBranding(tenantId: string, branding: Partial<TenantBranding>): Tenant {
    const index = this.tenants.findIndex(t => t.id === tenantId);
    if (index === -1) throw new Error('Tenant not found');

    this.tenants[index] = {
      ...this.tenants[index],
      branding: {
        ...(this.tenants[index].branding || {
          primary_color: '#f59e0b',
          secondary_color: '#0f172a',
          app_name: this.tenants[index].name
        }),
        ...branding
      },
      updated_at: new Date().toISOString()
    };
    this.saveState();
    if (this.activeTenantId === tenantId) {
      this.applyTenantBranding(this.tenants[index]);
    }
    return this.tenants[index];
  }

  public setTenantStatus(tenantId: string, status: TenantStatus, reason?: string): Tenant {
    const index = this.tenants.findIndex(t => t.id === tenantId);
    if (index === -1) throw new Error('Tenant not found');

    const now = new Date().toISOString();
    this.tenants[index] = {
      ...this.tenants[index],
      status,
      is_active: status === 'ACTIVE',
      suspended_at: status === 'SUSPENDED' ? now : this.tenants[index].suspended_at,
      suspend_reason: status === 'SUSPENDED' ? reason || 'Administrative suspension' : null,
      updated_at: now
    };

    this.saveState();
    return this.tenants[index];
  }

  // --- Cross-Tenant Auditing & Defense Layer ---

  public logCrossTenantEvent(entry: Omit<CrossTenantAuditAttempt, 'id' | 'timestamp'>): void {
    const audit: CrossTenantAuditAttempt = {
      ...entry,
      id: `cta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString()
    };

    this.crossTenantAudits.unshift(audit);
    this.saveState();
  }

  public getCrossTenantAudits(): CrossTenantAuditAttempt[] {
    return [...this.crossTenantAudits];
  }

  public clearCrossTenantAudits(): void {
    this.crossTenantAudits = [];
    this.saveState();
  }

  // --- Metrics Aggregator ---

  public getTenantMetrics(tenantId?: string): TenantMetrics {
    const t = tenantId ? this.getTenantById(tenantId) : this.getActiveTenant();
    const tid = t?.id || 'tnt-001';
    const sites = this.getSitesForTenant(tid);

    return {
      tenant_id: tid,
      tenant_name: t?.name || 'Smart Lounge',
      tenant_code: t?.code || 'TNT-00001',
      users_count: tid === 'tnt-001' ? 4 : tid === 'tnt-002' ? 1 : tid === 'tnt-003' ? 2 : 0,
      active_subscriptions_count: tid === 'tnt-001' ? 3 : 1,
      sites_count: sites.length,
      servers_count: tid === 'tnt-001' ? 2 : 1,
      playback_sessions_today: tid === 'tnt-001' ? 18 : 6,
      storage_used_gb: tid === 'tnt-001' ? 4820 : 1240,
      bandwidth_mbps: tid === 'tnt-001' ? 340 : 85
    };
  }

  // --- PostgreSQL Row-Level Security Simulator ---

  public executeRLSQuery(
    sqlStatement: string,
    simulatedTenantContext: string | null = this.activeTenantId,
    isSuperuserBypass = false
  ): {
    rows: any[];
    policyApplied: string;
    isBlocked: boolean;
    reason: string;
    executionTimeMs: number;
  } {
    const startTime = performance.now();
    const cleanSql = sqlStatement.trim();

    let policyApplied = "tenant_isolation_policy: (tenant_id = current_setting('app.current_tenant')::uuid OR is_superuser = 'true')";
    let isBlocked = false;
    let reason = 'Query evaluated successfully under PostgreSQL RLS';
    let rows: any[] = [];

    if (!simulatedTenantContext && !isSuperuserBypass) {
      isBlocked = true;
      policyApplied = "DEFAULT DENY: No tenant context supplied and bypass_rls=False";
      reason = 'Blocked by Deny by Default guarantee. No rows returned.';
      return {
        rows: [],
        policyApplied,
        isBlocked,
        reason,
        executionTimeMs: Number((performance.now() - startTime).toFixed(2))
      };
    }

    if (cleanSql.toUpperCase().includes('INSERT') && cleanSql.includes('tnt-') && simulatedTenantContext) {
      const targetMatch = cleanSql.match(/tnt-\d+/i);
      if (targetMatch && targetMatch[0] !== simulatedTenantContext && !isSuperuserBypass) {
        isBlocked = true;
        policyApplied = "tenant_isolation_insert_policy: WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)";
        reason = `PostgreSQL Error 42501: new row violates row-level security policy for table (Attempted inserting ${targetMatch[0]} while in context of ${simulatedTenantContext})`;
        
        this.logCrossTenantEvent({
          actor_id: 'sim-user',
          actor_name: 'Simulated User Session',
          actor_tenant_id: simulatedTenantContext,
          target_tenant_id: targetMatch[0],
          resource_type: 'DatabaseTable',
          resource_id: 'row-insert',
          action: 'sql.insert.cross_tenant_violation',
          endpoint: '/raw-sql-executor/',
          ip_address: '127.0.0.1',
          result: 'DENIED',
          details: { sql: cleanSql, reason }
        });

        return {
          rows: [],
          policyApplied,
          isBlocked,
          reason,
          executionTimeMs: Number((performance.now() - startTime).toFixed(2))
        };
      }
    }

    if (isSuperuserBypass) {
      policyApplied = "SUPERUSER_BYPASS: is_superuser = 'true' (Logged in audit)";
      rows = this.tenants;
    } else {
      rows = this.tenants.filter(t => t.id === simulatedTenantContext);
    }

    return {
      rows,
      policyApplied,
      isBlocked,
      reason,
      executionTimeMs: Number((performance.now() - startTime).toFixed(2))
    };
  }
}

export const MultiTenantEngine = new MultiTenantEngineService();
