export type UserStatus = 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED';

export type PermissionCategory = 'content' | 'features' | 'admin' | 'playback' | 'system';
export type PermissionResourceType = 'MEDIA_ITEM' | 'MEDIA_SERVER' | 'USER' | 'PROFILE' | 'TENANT' | 'SITE' | 'SYSTEM';
export type PermissionAction = 'view' | 'play' | 'download' | 'create' | 'edit' | 'delete' | 'manage' | 'publish';
export type RoleScopeLevel = 'GLOBAL' | 'TENANT' | 'SITE' | 'USER';

export interface Permission {
  id: string;
  code: string;
  name: string;
  category: PermissionCategory;
  resource_type?: PermissionResourceType;
  action?: PermissionAction;
  description: string;
  is_system?: boolean;
  requires_scope?: boolean;
}

export interface Role {
  id: string;
  code: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'SITE_MANAGER' | 'CONTENT_MANAGER' | 'SUPPORT' | 'USER' | string;
  name: string;
  description: string;
  is_system: boolean;
  scope_level: RoleScopeLevel;
  is_assignable: boolean;
  permissions_count?: number;
  permissions_map?: RolePermission[];
}

export interface RolePermission {
  id: string;
  role_id?: string;
  permission_code: string;
  permission_name: string;
  effect: 'ALLOW' | 'DENY';
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  user_name: string;
  role_id: string;
  role_code: string;
  role_name: string;
  role_scope: RoleScopeLevel;
  tenant_id?: string | null;
  tenant_name?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  assigned_at: string;
  expires_at?: string | null;
  is_active: boolean;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

export interface PermissionGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  tenant_id?: string | null;
  role_id?: string | null;
  is_system: boolean;
  priority: number;
  permissions: Array<{
    permission_code: string;
    permission_name?: string;
    effect: 'ALLOW' | 'DENY';
  }>;
  members_count: number;
}

export interface UserGroupAssignment {
  id: string;
  user_id: string;
  user_name?: string;
  group_id: string;
  group_name: string;
  group_code: string;
  priority: number;
  tenant_id?: string | null;
  site_id?: string | null;
  is_active: boolean;
}

export interface ResourcePermissionOverride {
  id: string;
  user_id: string;
  user_name?: string;
  resource_type: PermissionResourceType;
  resource_id: string;
  resource_name?: string;
  permission_code: string;
  permission_name: string;
  is_granted: boolean;
  reason: string;
  expires_at?: string | null;
}

export interface PermissionEvaluationStep {
  layer: string;
  result: 'ALLOW' | 'DENY' | 'SKIPPED' | 'DENY (ABSENT)';
  detail: string;
  active: boolean;
}

export interface PermissionSimulationResult {
  decision: boolean;
  decision_layer: string;
  reason: string;
  permission_code: string;
  user_lounge_id: string;
  steps: PermissionEvaluationStep[];
}

export interface MediaAccessEvaluationResult {
  item_id: string;
  title: string;
  can_view: boolean;
  can_stream: boolean;
  can_download: boolean;
  is_premium: boolean;
  is_kids: boolean;
  resolution: string;
  reasons: string[];
  quality_profile: string;
  external_player_allowed: boolean;
  casting_allowed: boolean;
}

export interface Profile {
  id: string;
  name: string;
  code: 'Basic' | 'Premium' | 'Kids' | 'Admin' | string;
  description: string;
  is_system: boolean;
  permissions: string[];
  max_devices: number;
  max_concurrent_sessions: number;
}

export interface UserPermissionOverride {
  id: string;
  permission_code: string;
  permission_name: string;
  is_granted: boolean;
  reason: string;
  expires_at?: string | null;
}

export interface LoungeUser {
  id: string;
  lounge_id: string; // e.g. "LU-000152"
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  language: 'ar' | 'en';
  timezone: string;
  status: UserStatus;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  active_profile: Profile;
  overrides: UserPermissionOverride[];
  created_at: string;
  ip_address?: string;
  connected_device?: string;
}

export interface MediaServer {
  id: string;
  name: string;
  server_type: 'jellyfin' | 'emby' | 'plex' | 'custom';
  local_url: string;
  api_key: string;
  is_active: boolean;
  status: 'online' | 'offline' | 'error' | 'syncing';
  last_ping_at?: string;
  last_sync_at?: string;
  server_info?: {
    server_name?: string;
    version?: string;
    id?: string;
    operating_system?: string;
  };
  libraries_count?: number;
}

export interface Library {
  id: string;
  server_id: string;
  server_name: string;
  external_id: string;
  name: string;
  collection_type: 'movies' | 'tvshows' | 'kids' | 'documentaries' | 'mixed';
  required_permission: string;
  is_enabled: boolean;
  synced_items_count: number;
}

export interface Episode {
  id: string;
  episode_number: number;
  title: string;
  duration_minutes: number;
  stream_url: string;
}

export interface Season {
  id: string;
  season_number: number;
  title: string;
  episodes: Episode[];
}

export interface MediaItem {
  id: string;
  library_id: string;
  library_name: string;
  server_id: string;
  external_id: string;
  title: string;
  original_title?: string;
  item_type: 'movie' | 'series' | 'episode';
  year: number;
  duration_minutes: number;
  rating: number;
  overview: string;
  genres: string[];
  poster_url: string;
  backdrop_url: string;
  resolution: string; // e.g. "4K HDR", "1080p FHD"
  is_premium: boolean;
  is_kids: boolean;
  audio_languages: string[];
  subtitle_languages: string[];
  stream_url: string;
  view_count: number;
  seasons?: Season[];
}

export type TenantStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | 'DELETED';
export type TenantPlan = 'FREE' | 'BASIC' | 'STANDARD' | 'ENTERPRISE';
export type SiteStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type SiteType = 'LOUNGE' | 'HOTEL' | 'CAFE' | 'OFFICE' | 'RESIDENTIAL' | 'OTHER';
export type SiteIsolationMode = 'NONE' | 'STRICT' | 'SHARED_MEDIA';

export interface TenantBranding {
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  app_name: string;
  app_subtitle?: string;
  login_bg_url?: string;
  custom_css?: string;
}

export interface TenantSettings {
  max_concurrent_sessions?: number;
  session_ttl_minutes?: number;
  default_language?: 'ar' | 'en';
  site_isolation?: SiteIsolationMode;
  allow_downloads?: boolean;
  max_bitrate_mbps?: number;
  require_device_approval?: boolean;
  transcoding_allowed?: boolean;
  watermark_enabled?: boolean;
  [key: string]: any;
}

export interface Tenant {
  id: string;
  name: string;
  name_ar?: string;
  name_en?: string;
  slug: string;
  code: string; // e.g. "TNT-00001"
  status: TenantStatus;
  is_active?: boolean;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  country?: string;
  timezone: string;
  default_language: 'ar' | 'en';
  supported_languages: string[];
  default_currency: string;
  subscription_plan: TenantPlan;
  max_users?: number;
  max_sites?: number;
  max_media_servers?: number;
  trial_ends_at?: string | null;
  activated_at?: string | null;
  suspended_at?: string | null;
  suspend_reason?: string | null;
  metadata?: Record<string, any>;
  settings?: TenantSettings;
  branding?: TenantBranding;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface SiteSettings {
  max_concurrent_sessions?: number;
  timezone?: string;
  language?: 'ar' | 'en';
  bandwidth_limit_mbps?: number;
  [key: string]: any;
}

export interface Site {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  name: string;
  code: string; // e.g. "SITE-01"
  slug: string;
  status: SiteStatus;
  site_type: SiteType;
  is_active?: boolean;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  language?: 'ar' | 'en';
  contact_person?: string;
  contact_phone?: string;
  capacity?: number;
  settings?: SiteSettings;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface CrossTenantAuditAttempt {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_tenant_id?: string;
  actor_tenant_name?: string;
  target_tenant_id: string;
  target_tenant_name?: string;
  resource_type: string;
  resource_id: string;
  action: string;
  endpoint: string;
  ip_address: string;
  result: 'DENIED' | 'ALLOWED' | 'ALERT_TRIGGERED';
  timestamp: string;
  details?: Record<string, any>;
}

export interface RLSTestResult {
  test_id: string;
  name: string;
  description: string;
  category: 'RLS_ISOLATION' | 'RAW_SQL' | 'NO_CONTEXT' | 'SUPERUSER_BYPASS' | 'CROSS_TENANT_WRITE' | 'SITE_ISOLATION';
  status: 'PASSED' | 'FAILED' | 'RUNNING' | 'PENDING';
  sql_executed: string;
  policy_evaluated: string;
  execution_time_ms: number;
  details: string;
  expected: string;
  actual: string;
}

export interface TenantMetrics {
  tenant_id: string;
  tenant_name: string;
  tenant_code: string;
  users_count: number;
  active_subscriptions_count: number;
  sites_count: number;
  servers_count: number;
  playback_sessions_today: number;
  storage_used_gb: number;
  bandwidth_mbps: number;
}

export interface ExternalIdentity {
  id: string;
  user_id?: string;
  user_lounge_id?: string;
  user_full_name?: string;
  identity_type: 'MIKROTIK' | 'RADIUS' | 'GOOGLE' | 'LOCAL';
  external_id: string;
  is_primary: boolean;
  is_verified: boolean;
  first_seen_at: string;
  last_seen_at: string;
  external_metadata?: Record<string, any>;
}

export interface LoungeSession {
  id: string;
  user_id: string;
  user_lounge_id: string;
  user_full_name: string;
  session_token_hash: string;
  refresh_token_hash?: string;
  ip_address: string;
  user_agent: string;
  device_fingerprint?: string;
  mikrotik_session_id?: string;
  radius_session_id?: string;
  source: 'HOTSPOT' | 'RADIUS' | 'SSO' | 'MANUAL';
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  is_valid: boolean;
  issued_at: string;
  expires_at: string;
  last_activity_at: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

export interface MikroTikRouterInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  use_ssl: boolean;
  username: string;
  identity: string;
  routeros_version: string;
  model: string;
  is_online: boolean;
  is_active: boolean;
  latency_ms: number;
  cpu_load: number;
  memory_free_mb: number;
  uptime: string;
  active_hotspot_users_count: number;
  last_seen_at?: string;
}

export interface HotspotActiveUser {
  id: string;
  user: string;
  address: string;
  mac_address: string;
  uptime: string;
  session_time_left: string;
  bytes_out: number;
  bytes_in: number;
  radius: boolean;
}

export interface RadiusServerInfo {
  id: string;
  name: string;
  host: string;
  auth_port: number;
  acct_port: number;
  role: 'PRIMARY' | 'SECONDARY' | 'FAILOVER';
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  priority: number;
  is_active: boolean;
  latency_ms: number;
  total_requests: number;
  failed_requests: number;
  last_health_check?: string;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  event_type_display: string;
  user_lounge_id?: string;
  user_full_name?: string;
  external_identity_ref: string;
  ip_address?: string;
  user_agent?: string;
  details: Record<string, any>;
  created_at: string;
}

// ==========================================
// Phase 6: Secure Playback & Video Player Types
// ==========================================

export type PlaybackMethod = 'DIRECT_PLAY' | 'DIRECT_STREAM' | 'TRANSCODE';
export type PlaybackSessionStatus = 'STARTING' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ENDED' | 'STOPPED' | 'ERROR';
export type PlaybackScope = 'WEB' | 'EXTERNAL' | 'CAST' | 'DOWNLOAD';
export type ExternalPlayerType = 'vlc' | 'infuse' | 'kodi' | 'mxplayer' | 'browser';

export interface Device {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_type: 'WEB' | 'ANDROID' | 'IOS' | 'TV' | 'DESKTOP' | 'OTHER';
  device_name: string;
  os?: string;
  browser?: string;
  app_version?: string;
  is_trusted: boolean;
  is_blocked: boolean;
  first_seen_at: string;
  last_seen_at: string;
  last_ip?: string;
  metadata?: Record<string, any>;
}

export interface PlaybackToken {
  id: string;
  token_hash: string;
  user_id: string;
  profile_id?: string;
  device_id?: string;
  media_item_id: string;
  media_source_id?: string;
  media_server_id?: string;
  external_playback_id: string;
  playback_session_id?: string;
  scope: PlaybackScope;
  ip_address: string;
  user_agent: string;
  issued_at: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  max_uses: number;
  current_uses: number;
}

export interface PlaybackSession {
  id: string;
  user_id: string;
  user_lounge_id: string;
  user_full_name: string;
  profile_name?: string;
  device_id?: string;
  device_name?: string;
  media_item_id: string;
  media_item_title: string;
  media_item_poster?: string;
  media_server_name: string;
  external_playback_id: string;
  playback_method: PlaybackMethod;
  status: PlaybackSessionStatus;
  started_at: string;
  ended_at?: string | null;
  last_heartbeat_at: string;
  position_seconds: number;
  duration_seconds: number;
  watched_seconds: number;
  playback_rate: number;
  resolution: string;
  audio_track: string;
  subtitle_track: string;
  client_ip: string;
  bitrate_mbps?: number;
  correlation_id: string;
}

export interface WatchHistory {
  id: string;
  user_id: string;
  profile_id?: string;
  media_item_id: string;
  media_item: MediaItem;
  position_seconds: number;
  duration_seconds: number;
  completion_percentage: number;
  is_completed: boolean;
  last_watched_at: string;
  first_watched_at: string;
  watch_count: number;
}

export interface PlaybackStartRequest {
  media_item_id: string;
  media_source_id?: string;
  quality?: string;
  scope?: PlaybackScope;
  resume?: boolean;
}

export interface PlaybackStartResponse {
  playback_session_id: string;
  token: string;
  manifest_url: string;
  stream_url: string;
  resume_position: number;
  duration: number;
  quality: string;
  playback_method: PlaybackMethod;
  audio_tracks: string[];
  subtitle_tracks: string[];
  available_qualities: string[];
  delivery_node: string;
}

export interface HeartbeatRequest {
  playback_session_id: string;
  position_seconds: number;
  status: PlaybackSessionStatus;
  playback_rate?: number;
}

export interface HeartbeatResponse {
  should_stop: boolean;
  next_token?: string | null;
  stop_reason?: string;
}

export interface ExternalPlayerLaunchRequest {
  media_item_id: string;
  player_type: ExternalPlayerType;
}

export interface ExternalPlayerLaunchResponse {
  launch_url: string;
  raw_stream_url: string;
  token: string;
  expires_at: string;
  instructions: string;
  player_name: string;
}

// ==========================================
// PHASE 7: SUBSCRIPTIONS, BILLING & COMMERCE
// ==========================================

export type PlanType = 'BASIC' | 'STANDARD' | 'VIP' | 'PREMIUM' | 'CUSTOM';
export type AddOnType = 'CONTENT' | 'FEATURE' | 'CAPACITY' | 'TEMPORARY';
export type PromotionType = 'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'FREE_DAYS' | 'UPGRADE' | 'BUNDLE';
export type PromotionAppliesTo = 'PLAN' | 'ADDON' | 'ALL';
export type EntitlementSourceType = 'PLAN' | 'ADDON' | 'PROMOTION' | 'MANUAL';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
export type SubscriptionSourceType = 'DIRECT_PURCHASE' | 'CARD_REDEEM' | 'PROMOTION' | 'MANUAL_GRANT' | 'TRIAL' | 'MIGRATION';
export type SubscriptionEventType =
  | 'CREATED'
  | 'ACTIVATED'
  | 'RENEWED'
  | 'UPGRADED'
  | 'DOWNGRADED'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'RESUMED'
  | 'CANCELLED'
  | 'GRACE_STARTED'
  | 'GRACE_ENDED';

export type CardType = 'TIME' | 'DATA' | 'PLAN';
export type CardStatus = 'UNUSED' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
export type CardBatchStatus = 'DRAFT' | 'GENERATING' | 'READY' | 'EXPORTED' | 'ARCHIVED';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CARD_MANUAL'
  | 'PAYMENT_GATEWAY'
  | 'CARD_REDEEM'
  | 'PROMOTION'
  | 'WALLET'
  | 'OTHER';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
export type PaymentTransactionType = 'CHARGE' | 'REFUND' | 'ADJUSTMENT' | 'WRITE_OFF' | 'CREDIT';

export interface Plan {
  id: string;
  code: string;
  name: string;
  name_ar: string;
  name_en: string;
  description?: string;
  plan_type: PlanType;
  duration_days: number;
  duration_hours: number;
  price: number;
  currency: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  max_devices: number;
  max_concurrent_sessions: number;
  grace_period_days: number;
  entitlements_template: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AddOn {
  id: string;
  code: string;
  name: string;
  name_ar: string;
  name_en: string;
  description?: string;
  addon_type: AddOnType;
  duration_days: number;
  price: number;
  currency: string;
  is_active: boolean;
  entitlement_grants: Record<string, any>;
  is_stackable: boolean;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description?: string;
  promotion_type: PromotionType;
  applies_to: PromotionAppliesTo;
  target_plan_codes: string[];
  discount_value?: number;
  free_days?: number;
  upgrade_to_plan_code?: string;
  valid_from: string;
  valid_until: string;
  max_uses?: number;
  current_uses: number;
  max_uses_per_user: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entitlement {
  id: string;
  user_id: string;
  source_type: EntitlementSourceType;
  source_id: string;
  entitlement_code: string;
  value: any; // boolean, number, string, array
  quantity: number;
  is_active: boolean;
  granted_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  user_name?: string;
  plan_id: string;
  plan: Plan;
  profile_id?: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  grace_period_ends_at?: string | null;
  activated_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  suspended_at?: string | null;
  suspend_reason?: string | null;
  source_type: SubscriptionSourceType;
  source_reference?: string | null;
  auto_renew: boolean;
  price_paid?: number;
  currency: string;
  discount_applied?: number;
  promotion_id?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionHistory {
  id: string;
  subscription_id?: string;
  user_id: string;
  event_type: SubscriptionEventType;
  old_plan_code?: string | null;
  new_plan_code?: string | null;
  old_status?: string | null;
  new_status?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  reason?: string | null;
  metadata?: Record<string, any>;
  occurred_at: string;
}

export interface AddOnSubscription {
  id: string;
  user_id: string;
  addon_id: string;
  addon: AddOn;
  parent_subscription_id?: string;
  started_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  price_paid?: number;
  created_at: string;
  updated_at: string;
}

export interface HotspotCard {
  id: string;
  card_id: string;
  card_type: CardType;
  radius_username?: string;
  radius_password_hash?: string;
  pin_code: string; // Used for UI scratch validation
  plan_id?: string;
  plan?: Plan;
  duration_days?: number;
  data_limit_gb?: number;
  price: number;
  currency: string;
  status: CardStatus;
  batch_id?: string;
  linked_user_id?: string;
  linked_user_name?: string;
  linked_subscription_id?: string;
  radius_identity_id?: string;
  activated_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

export interface CardBatch {
  id: string;
  batch_code: string;
  plan_id?: string;
  plan_name?: string;
  total_cards: number;
  generated_cards: number;
  used_cards: number;
  price_per_card: number;
  currency: string;
  prefix?: string;
  status: CardBatchStatus;
  generated_at?: string;
  exported_at?: string;
  created_at: string;
  updated_at: string;
  created_by_name: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  item_type: 'PLAN' | 'ADDON' | 'PROMOTION' | 'DISCOUNT' | 'TAX' | 'FEE';
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  subscription_id?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string;
  paid_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  notes?: string;
  promotion_id?: string;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  invoice_number?: string;
  user_id: string;
  user_name: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider?: string;
  provider_reference?: string;
  status: PaymentStatus;
  completed_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  refunded_amount: number;
  refunded_at?: string | null;
  refund_reason?: string | null;
  notes?: string;
  idempotency_key: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  transaction_type: PaymentTransactionType;
  amount: number;
  currency: string;
  balance_before?: number;
  balance_after?: number;
  reference?: string;
  idempotency_key: string;
  metadata?: Record<string, any>;
  created_at: string;
  created_by_name?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'FIXED' | 'PERCENT';
  discount_value: number;
  applies_to: 'PLAN' | 'ADDON' | 'ALL';
  valid_from: string;
  valid_until: string;
  max_uses?: number;
  current_uses: number;
  max_uses_per_user: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  coupon_code: string;
  user_id: string;
  invoice_id?: string;
  redeemed_at: string;
  discount_applied: number;
}

export interface BillingDashboardSummary {
  summary: {
    active_subscriptions: number;
    expiring_in_7_days: number;
    in_grace_period: number;
    expired_last_30_days: number;
    total_users: number;
  };
  revenue: {
    today: number;
    this_month: number;
    last_month: number;
    growth_percent: number;
    currency: string;
  };
  outstanding: {
    invoices_pending: number;
    total_amount: number;
    overdue_count: number;
  };
  cards: {
    unused: number;
    active: number;
    used_last_30_days: number;
  };
  top_plans: Array<{
    plan: string;
    count: number;
    revenue: number;
  }>;
}

// =========================================================================
// Phase 10: Media Server Account Management Types
// =========================================================================

export type ProvisioningMode = 'MANUAL' | 'AUTO' | 'DISABLED';
export type ProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'DISABLED' | 'DELETED';
export type MediaSyncStatus = 'IN_SYNC' | 'OUT_OF_SYNC' | 'UNKNOWN' | 'ERROR';
export type OrphanUserStatus = 'NEW' | 'IGNORED' | 'CLAIMED' | 'DELETED';

export interface MediaAccountMapping {
  id: string;
  media_server: string;
  media_server_name: string;
  media_server_url: string;
  server_type: 'jellyfin' | 'emby' | 'plex' | 'custom';
  user: string;
  user_username: string;
  user_lounge_id: string;
  external_user_id: string;
  external_username: string;
  has_stored_password?: boolean;
  provisioning_mode: ProvisioningMode;
  provisioning_status: ProvisioningStatus;
  provisioning_error?: string | null;
  provisioning_attempts: number;
  sync_status: MediaSyncStatus;
  sync_details?: Record<string, any>;
  media_server_policy?: Record<string, any>;
  is_active: boolean;
  disabled_at?: string | null;
  disabled_reason?: string | null;
  last_sync_at?: string | null;
  last_provisioned_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaServerUserSync {
  id: string;
  media_server: string;
  media_server_name: string;
  sync_type: 'FULL' | 'INCREMENTAL' | 'RECONCILIATION';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
  started_at: string;
  completed_at?: string | null;
  users_checked: number;
  users_created: number;
  users_updated: number;
  users_disabled: number;
  users_deleted: number;
  mappings_fixed: number;
  orphans_found: number;
  conflicts_found: number;
  last_error?: string | null;
  triggered_by: 'SCHEDULED' | 'MANUAL' | 'EVENT';
  triggered_by_username?: string | null;
  correlation_id: string;
  metadata?: Record<string, any>;
}

export interface MediaServerOrphanUser {
  id: string;
  media_server: string;
  media_server_name: string;
  external_user_id: string;
  external_username: string;
  detected_at: string;
  status: OrphanUserStatus;
  claimed_by_user?: string | null;
  claimed_by_username?: string | null;
  claimed_at?: string | null;
  resolved_by?: string | null;
  resolved_by_username?: string | null;
  resolution_note?: string | null;
  metadata?: Record<string, any>;
}

export interface ProvisioningConfig {
  id: string;
  name: string;
  provisioning_enabled: boolean;
  provisioning_mode: ProvisioningMode;
  auto_create_on_first_login: boolean;
  auto_create_on_playback: boolean;
  auto_disable_on_subscription_expire: boolean;
  auto_delete_on_user_delete: boolean;
  username_pattern: string;
  username_include_tenant: boolean;
  default_library_ids: string[];
  default_policy: Record<string, any>;
  sync_interval_minutes: number;
  last_full_sync_at?: string | null;
  last_user_sync_at?: string | null;
}

export interface ProvisioningDashboardMetrics {
  health_status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  success_rate: number;
  total_mappings: number;
  completed: number;
  failed: number;
  pending: number;
  disabled: number;
  in_sync: number;
  out_of_sync: number;
  active_orphans: number;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
}

// =========================================================================
// Phase 18: Live TV, EPG & Sports Models
// =========================================================================

export type LiveChannelCategory = 'SPORTS' | 'ENTERTAINMENT' | 'NEWS' | 'MOVIES' | 'DOCUMENTARY' | 'KIDS';

export interface EPGProgram {
  id: string;
  channel_id: string;
  title: string;
  description: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  genre: string;
  is_live: boolean;
  thumbnail?: string;
}

export interface LiveChannel {
  id: string;
  number: number;
  name: string;
  category: LiveChannelCategory;
  logo_url: string;
  stream_url: string;
  resolution: string; // "1080p 60fps", "4K HDR"
  bitrate_mbps: number;
  is_premium: boolean;
  server_source: string; // e.g. "LAN Tuner Gateway A1"
  current_program?: EPGProgram;
  upcoming_programs?: EPGProgram[];
}

export interface SportsMatch {
  id: string;
  tournament: string; // e.g. "دوري أبطال أوروبا", "الدوري الإنجليزي الممتاز"
  round: string;      // e.g. "دور الـ 16", "الجولة 28"
  home_team: {
    name: string;
    logo: string;
    score?: number;
  };
  away_team: {
    name: string;
    logo: string;
    score?: number;
  };
  start_time: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  current_minute?: string; // e.g. "67'"
  stadium: string;
  commentator: string;
  channel_id: string;
  channel_name: string;
  is_featured: boolean;
}

// =========================================================================
// Phase 19: Content Requests, Support Tickets & In-App Notifications
// =========================================================================

export type ContentRequestStatus = 'PENDING' | 'APPROVED' | 'DOWNLOADING' | 'AVAILABLE' | 'REJECTED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';

export interface ContentRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_lounge_id: string;
  title: string;
  media_type: 'movie' | 'series';
  release_year?: number;
  tmdb_id?: string;
  poster_url?: string;
  notes?: string;
  status: ContentRequestStatus;
  progress_percent?: number;
  votes: number;
  voted_by_users: string[];
  created_at: string;
  updated_at: string;
  admin_reply?: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_type: 'USER' | 'AGENT' | 'SYSTEM';
  sender_name: string;
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  user_name: string;
  category: 'NETWORK_WIFI' | 'PLAYBACK_BUFFERING' | 'VOUCHER_BILLING' | 'ACCOUNT_ACCESS' | 'GENERAL';
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  messages: SupportTicketMessage[];
}

export type NotificationType = 'NEW_EPISODE' | 'CARD_EXPIRING' | 'REQUEST_APPROVED' | 'MAINTENANCE' | 'SECURITY' | 'PROMOTION';

export interface AppNotification {
  id: string;
  user_id?: string; // null for broadcast
  title: string;
  message: string;
  type: NotificationType;
  created_at: string;
  is_read: boolean;
  action_label?: string;
  action_target?: string;
  metadata?: Record<string, any>;
}

// =========================================================================
// Phase 20: AI Gateway & Autonomy Hub Types
// =========================================================================

export type AIAutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: 'OLLAMA_LOCAL' | 'GEMINI' | 'CLAUDE' | 'OPENAI';
  context_window: number;
  is_local: boolean;
  latency_ms: number;
  parameters: string;
  status: 'ONLINE' | 'STANDBY' | 'DOWNLOADING';
}

export interface AIWorkflowAudit {
  id: string;
  timestamp: string;
  user_lounge_id: string;
  query: string;
  rag_documents_retrieved: number;
  model_used: string;
  autonomy_level: AIAutonomyLevel;
  guardrails_passed: boolean;
  tool_invoked?: string;
  execution_result: string;
  latency_ms: number;
}

export interface SelfHealingAction {
  id: string;
  event: string;
  detected_at: string;
  severity: 'WARNING' | 'CRITICAL' | 'INFO';
  policy_rule: string;
  autonomy_level: AIAutonomyLevel;
  proposed_action: string;
  status: 'EXECUTED' | 'AWAITING_APPROVAL' | 'REVERTED';
  target_service: string;
}

// =========================================================================
// Phase 21: Observability, Distributed Traces & Disaster Recovery
// =========================================================================

export interface TraceSpan {
  id: string;
  name: string;
  service: 'API_GATEWAY' | 'DJANGO_CORE' | 'REDIS_CACHE' | 'POSTGRES_PGVECTOR' | 'CELERY_WORKER' | 'JELLYFIN_CONNECTOR' | 'MIKROTIK_ROUTEROS';
  duration_ms: number;
  status: 'SUCCESS' | 'ERROR';
  details?: string;
}

export interface DistributedTrace {
  trace_id: string;
  correlation_id: string;
  timestamp: string;
  user_id: string;
  endpoint: string;
  http_method: string;
  status_code: number;
  total_duration_ms: number;
  spans: TraceSpan[];
}

export interface BackupStatus {
  last_snapshot_at: string;
  backup_strategy: '3-2-1 Strategy (3 Copies, 2 Media, 1 Off-site)';
  local_nvme_copy: boolean;
  nas_secondary_copy: boolean;
  encrypted_cloud_replica: boolean;
  rpo_minutes: number;
  rto_minutes: number;
  db_size_mb: number;
  media_metadata_size_mb: number;
  last_restore_drill_status: 'PASSED' | 'FAILED';
}


