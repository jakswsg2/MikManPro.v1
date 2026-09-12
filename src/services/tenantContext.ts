/**
 * TenantContext Engine — ContextVars & PostgreSQL Session State
 * 
 * Implements ContextVar behavior (compatible with async / thread-safety)
 * and simulates SET LOCAL app.current_tenant for PostgreSQL Row-Level Security.
 */

export interface TenantContextState {
  tenant_id: string | null;
  site_id: string | null;
  user_id: string | null;
  is_superuser: boolean;
  bypass_rls: boolean;
}

class ContextVar<T> {
  private name: string;
  private defaultValue: T;
  private currentValue: T;

  constructor(name: string, defaultValue: T) {
    this.name = name;
    this.defaultValue = defaultValue;
    this.currentValue = defaultValue;
  }

  get(): T {
    return this.currentValue;
  }

  set(value: T): { var: ContextVar<T>; prev: T } {
    const prev = this.currentValue;
    this.currentValue = value;
    return { var: this, prev };
  }

  reset(token: { var: ContextVar<T>; prev: T }) {
    this.currentValue = token.prev;
  }
}

// Module-level ContextVars matching Django core/context.py
const _current_tenant_id = new ContextVar<string | null>('current_tenant_id', 'tnt-001');
const _current_site_id = new ContextVar<string | null>('current_site_id', 'site-001-1');
const _current_user_id = new ContextVar<string | null>('current_user_id', null);
const _is_superuser = new ContextVar<boolean>('is_superuser', false);
const _bypass_rls = new ContextVar<boolean>('bypass_rls', false);

export class TenantContextException extends Error {
  constructor(message = 'Tenant Context Missing: Deny by Default rule blocked request.') {
    super(message);
    this.name = 'TenantContextMissing';
  }
}

export class CrossTenantViolationException extends Error {
  constructor(message = 'Cross-Tenant Access Violation: Attempted access outside tenant boundary.') {
    super(message);
    this.name = 'CrossTenantViolation';
  }
}

export class TenantContext {
  private tenant_id: string | null;
  private site_id: string | null;
  private user_id: string | null;
  private is_superuser: boolean;
  private bypass_rls: boolean;
  private tokens: Array<{ var: ContextVar<any>; prev: any }> = [];

  constructor(options: {
    tenant_id?: string | null;
    site_id?: string | null;
    user_id?: string | null;
    is_superuser?: boolean;
    bypass_rls?: boolean;
  } = {}) {
    this.tenant_id = options.tenant_id !== undefined ? options.tenant_id : null;
    this.site_id = options.site_id !== undefined ? options.site_id : null;
    this.user_id = options.user_id !== undefined ? options.user_id : null;
    this.is_superuser = options.is_superuser || false;
    this.bypass_rls = options.bypass_rls || (this.is_superuser);
  }

  enter() {
    this.tokens = [
      _current_tenant_id.set(this.tenant_id),
      _current_site_id.set(this.site_id),
      _current_user_id.set(this.user_id),
      _is_superuser.set(this.is_superuser),
      _bypass_rls.set(this.bypass_rls),
    ];
    this.applyToDbSession();
    return this;
  }

  exit() {
    for (const token of this.tokens) {
      token.var.reset(token);
    }
    this.resetDbSession();
  }

  private applyToDbSession() {
    // In Django PostgreSQL backend, this executes:
    // SET LOCAL app.current_tenant = %s;
    // SET LOCAL app.is_superuser = %s;
    if (typeof window !== 'undefined') {
      (window as any).__PG_CURRENT_TENANT = this.tenant_id;
      (window as any).__PG_IS_SUPERUSER = this.is_superuser ? 'true' : 'false';
      (window as any).__PG_CURRENT_SITE = this.site_id;
    }
  }

  private resetDbSession() {
    if (typeof window !== 'undefined') {
      (window as any).__PG_CURRENT_TENANT = _current_tenant_id.get();
      (window as any).__PG_IS_SUPERUSER = _is_superuser.get() ? 'true' : 'false';
      (window as any).__PG_CURRENT_SITE = _current_site_id.get();
    }
  }

  static run<T>(
    options: {
      tenant_id?: string | null;
      site_id?: string | null;
      user_id?: string | null;
      is_superuser?: boolean;
      bypass_rls?: boolean;
    },
    fn: () => T
  ): T {
    const ctx = new TenantContext(options);
    ctx.enter();
    try {
      return fn();
    } finally {
      ctx.exit();
    }
  }
}

// Helper accessor functions
export function get_current_tenant_id(): string | null {
  return _current_tenant_id.get();
}

export function set_global_current_tenant_id(tenantId: string | null) {
  _current_tenant_id.set(tenantId);
}

export function get_current_site_id(): string | null {
  return _current_site_id.get();
}

export function set_global_current_site_id(siteId: string | null) {
  _current_site_id.set(siteId);
}

export function get_current_user_id(): string | null {
  return _current_user_id.get();
}

export function is_bypass_rls(): boolean {
  return _bypass_rls.get();
}

export function is_current_superuser(): boolean {
  return _is_superuser.get();
}

export function require_tenant_context(): string {
  const tid = get_current_tenant_id();
  if (!tid) {
    throw new TenantContextException('No active Tenant Context found in current execution thread.');
  }
  return tid;
}

/**
 * Tenant-Aware Cache Key Generator (Decision 59 & Phase 8 standard)
 */
export class CacheKeys {
  static tenant_key(prefix: string, ...parts: string[]): string {
    const tenant_id = get_current_tenant_id() || 'global';
    return `${prefix}:tenant:${tenant_id}:${parts.join(':')}`;
  }

  static perm_effective(user_id: string): string {
    return CacheKeys.tenant_key('perm', 'user', user_id, 'effective');
  }

  static billing_entitlements(user_id: string): string {
    return CacheKeys.tenant_key('billing', 'user', user_id, 'entitlements');
  }

  static content_library(library_id: string): string {
    return CacheKeys.tenant_key('content', 'library', library_id);
  }

  static media_server_health(server_id: string): string {
    return CacheKeys.tenant_key('server', 'health', server_id);
  }

  static tenant_settings(tenant_id: string): string {
    return `settings:tenant:${tenant_id}:effective`;
  }
}
