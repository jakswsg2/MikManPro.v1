import {
  MediaAccountMapping,
  MediaServerUserSync,
  MediaServerOrphanUser,
  ProvisioningConfig,
  ProvisioningDashboardMetrics,
  ProvisioningStatus,
  MediaSyncStatus
} from '../types';

const STORAGE_KEYS = {
  MAPPINGS: 'smartlounge_media_account_mappings_v1',
  SYNCS: 'smartlounge_media_user_syncs_v1',
  ORPHANS: 'smartlounge_media_orphan_users_v1',
  SERVERS: 'smartlounge_media_servers_config_v1',
};

const INITIAL_SERVERS: ProvisioningConfig[] = [
  {
    id: 'srv-lan-jellyfin-01',
    name: 'Jellyfin LAN Main (الرئيسي)',
    provisioning_enabled: true,
    provisioning_mode: 'AUTO',
    auto_create_on_first_login: true,
    auto_create_on_playback: false,
    auto_disable_on_subscription_expire: true,
    auto_delete_on_user_delete: false,
    username_pattern: 'LU-{lounge_id}',
    username_include_tenant: false,
    default_library_ids: ['lib-movies-lan', 'lib-series-lan'],
    default_policy: {
      EnableMediaPlayback: true,
      EnableAudioPlaybackTranscoding: true,
      EnableVideoPlaybackTranscoding: true,
      EnableContentDownloading: true,
    },
    sync_interval_minutes: 60,
    last_full_sync_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    last_user_sync_at: new Date(Date.now() - 60000 * 25).toISOString(),
  },
  {
    id: 'srv-lan-emby-vip-02',
    name: 'Emby VIP Cinema Lounge',
    provisioning_enabled: true,
    provisioning_mode: 'AUTO',
    auto_create_on_first_login: true,
    auto_create_on_playback: false,
    auto_disable_on_subscription_expire: true,
    auto_delete_on_user_delete: false,
    username_pattern: 'VIP-{lounge_id}',
    username_include_tenant: true,
    default_library_ids: ['lib-4k-uhd-vip', 'lib-movies-lan'],
    default_policy: {
      EnableMediaPlayback: true,
      EnableAudioPlaybackTranscoding: true,
      EnableVideoPlaybackTranscoding: true,
      EnableSyncTranscoding: true,
      EnableContentDownloading: true,
    },
    sync_interval_minutes: 30,
    last_full_sync_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    last_user_sync_at: new Date(Date.now() - 60000 * 10).toISOString(),
  }
];

const INITIAL_MAPPINGS: MediaAccountMapping[] = [
  {
    id: 'map-001',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    media_server_url: 'http://192.168.1.110:8096',
    server_type: 'jellyfin',
    user: 'u-1',
    user_username: 'ahmed_vip',
    user_lounge_id: 'LU-00101',
    external_user_id: 'jf-uid-99201',
    external_username: 'LU-00101',
    has_stored_password: true,
    provisioning_mode: 'AUTO',
    provisioning_status: 'COMPLETED',
    provisioning_attempts: 1,
    sync_status: 'IN_SYNC',
    sync_details: { last_activity: '2026-09-10 18:22:00', is_disabled_on_server: false },
    media_server_policy: { MaxParentalRating: null, EnableMediaPlayback: true },
    is_active: true,
    last_sync_at: new Date(Date.now() - 60000 * 25).toISOString(),
    last_provisioned_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    updated_at: new Date(Date.now() - 60000 * 25).toISOString(),
  },
  {
    id: 'map-002',
    media_server: 'srv-lan-emby-vip-02',
    media_server_name: 'Emby VIP Cinema Lounge',
    media_server_url: 'http://192.168.1.120:8096',
    server_type: 'emby',
    user: 'u-1',
    user_username: 'ahmed_vip',
    user_lounge_id: 'LU-00101',
    external_user_id: 'emby-uid-88310',
    external_username: 'VIP-00101',
    has_stored_password: true,
    provisioning_mode: 'AUTO',
    provisioning_status: 'COMPLETED',
    provisioning_attempts: 1,
    sync_status: 'IN_SYNC',
    sync_details: { is_disabled_on_server: false },
    media_server_policy: { EnableSyncTranscoding: true, EnableMediaPlayback: true },
    is_active: true,
    last_sync_at: new Date(Date.now() - 60000 * 10).toISOString(),
    last_provisioned_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 60000 * 10).toISOString(),
  },
  {
    id: 'map-003',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    media_server_url: 'http://192.168.1.110:8096',
    server_type: 'jellyfin',
    user: 'u-2',
    user_username: 'sarah_m',
    user_lounge_id: 'LU-00102',
    external_user_id: 'jf-uid-77402',
    external_username: 'LU-00102',
    has_stored_password: true,
    provisioning_mode: 'AUTO',
    provisioning_status: 'COMPLETED',
    provisioning_attempts: 1,
    sync_status: 'IN_SYNC',
    sync_details: { is_disabled_on_server: false },
    media_server_policy: { MaxParentalRating: 7, BlockedTags: ['horror', 'adult'] },
    is_active: true,
    last_sync_at: new Date(Date.now() - 60000 * 25).toISOString(),
    last_provisioned_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 60000 * 25).toISOString(),
  },
  {
    id: 'map-004',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    media_server_url: 'http://192.168.1.110:8096',
    server_type: 'jellyfin',
    user: 'u-3',
    user_username: 'khaled_k',
    user_lounge_id: 'LU-00103',
    external_user_id: 'jf-uid-55209',
    external_username: 'LU-00103',
    has_stored_password: true,
    provisioning_mode: 'AUTO',
    provisioning_status: 'DISABLED',
    provisioning_error: null,
    provisioning_attempts: 1,
    sync_status: 'IN_SYNC',
    sync_details: { is_disabled_on_server: true },
    is_active: false,
    disabled_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    disabled_reason: 'subscription_expired',
    last_sync_at: new Date(Date.now() - 60000 * 25).toISOString(),
    last_provisioned_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'map-005',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    media_server_url: 'http://192.168.1.110:8096',
    server_type: 'jellyfin',
    user: 'u-4',
    user_username: 'mona_art',
    user_lounge_id: 'LU-00104',
    external_user_id: '',
    external_username: 'LU-00104',
    has_stored_password: false,
    provisioning_mode: 'AUTO',
    provisioning_status: 'FAILED',
    provisioning_error: 'Connection timeout connecting to media server socket.',
    provisioning_attempts: 3,
    sync_status: 'ERROR',
    is_active: true,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  }
];

const INITIAL_ORPHANS: MediaServerOrphanUser[] = [
  {
    id: 'orph-001',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    external_user_id: 'jf-ext-unlinked-401',
    external_username: 'LocalGuestDesk3',
    detected_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    status: 'NEW',
    metadata: { last_login: '2026-09-09', is_disabled: false },
  },
  {
    id: 'orph-002',
    media_server: 'srv-lan-emby-vip-02',
    media_server_name: 'Emby VIP Cinema Lounge',
    external_user_id: 'emby-ext-unlinked-550',
    external_username: 'CinemaStaffTest',
    detected_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'IGNORED',
    resolution_note: 'حساب تجارب داخلي لإدارة السينما',
    resolved_by_username: 'admin',
    metadata: { is_disabled: true },
  }
];

const INITIAL_SYNCS: MediaServerUserSync[] = [
  {
    id: 'sync-hist-01',
    media_server: 'srv-lan-jellyfin-01',
    media_server_name: 'Jellyfin LAN Main (الرئيسي)',
    sync_type: 'INCREMENTAL',
    status: 'COMPLETED',
    started_at: new Date(Date.now() - 60000 * 25).toISOString(),
    completed_at: new Date(Date.now() - 60000 * 24).toISOString(),
    users_checked: 18,
    users_created: 0,
    users_updated: 17,
    users_disabled: 1,
    users_deleted: 0,
    mappings_fixed: 0,
    orphans_found: 1,
    conflicts_found: 0,
    triggered_by: 'SCHEDULED',
    correlation_id: 'corr-339-441-209',
  },
  {
    id: 'sync-hist-02',
    media_server: 'srv-lan-emby-vip-02',
    media_server_name: 'Emby VIP Cinema Lounge',
    sync_type: 'FULL',
    status: 'COMPLETED',
    started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
    users_checked: 8,
    users_created: 0,
    users_updated: 8,
    users_disabled: 0,
    users_deleted: 0,
    mappings_fixed: 0,
    orphans_found: 0,
    conflicts_found: 0,
    triggered_by: 'MANUAL',
    triggered_by_username: 'admin',
    correlation_id: 'corr-882-192-094',
  }
];

class MediaAccountEngine {
  private getStorage<T>(key: string, initial: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) {
        localStorage.setItem(key, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(data);
    } catch {
      return initial;
    }
  }

  private setStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Failed saving to ${key}:`, e);
    }
  }

  // ================= Mappings =================
  getMappings(filters?: { media_server_id?: string; status?: string; search?: string }): MediaAccountMapping[] {
    let items = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    if (filters?.media_server_id) {
      items = items.filter(m => m.media_server === filters.media_server_id);
    }
    if (filters?.status) {
      items = items.filter(m => m.provisioning_status === filters.status);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      items = items.filter(m =>
        m.user_username.toLowerCase().includes(s) ||
        m.user_lounge_id.toLowerCase().includes(s) ||
        m.external_username.toLowerCase().includes(s)
      );
    }
    return items;
  }

  getUserMappings(userId: string): MediaAccountMapping[] {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    return all.filter(m => m.user === userId && m.provisioning_status !== 'DELETED');
  }

  getMappingById(id: string): MediaAccountMapping | undefined {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    return all.find(m => m.id === id);
  }

  provisionUser(user: { id: string; username: string; lounge_id: string }, serverId: string): MediaAccountMapping {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const servers = this.getServers();
    const server = servers.find(s => s.id === serverId) || servers[0];

    const existing = all.find(m => m.user === user.id && m.media_server === serverId);
    if (existing && existing.provisioning_status === 'COMPLETED') {
      return existing;
    }

    const pattern = server.username_pattern || 'LU-{lounge_id}';
    const cleanLoungeId = user.lounge_id.replace('LU-', '');
    const generatedUsername = pattern.replace('{lounge_id}', cleanLoungeId).replace('{username}', user.username);

    const newMapping: MediaAccountMapping = {
      id: `map-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      media_server: server.id,
      media_server_name: server.name,
      media_server_url: server.id.includes('emby') ? 'http://192.168.1.120:8096' : 'http://192.168.1.110:8096',
      server_type: server.id.includes('emby') ? 'emby' : 'jellyfin',
      user: user.id,
      user_username: user.username,
      user_lounge_id: user.lounge_id,
      external_user_id: `ext-uid-${Math.floor(Math.random() * 900000 + 100000)}`,
      external_username: generatedUsername,
      has_stored_password: true,
      provisioning_mode: server.provisioning_mode,
      provisioning_status: 'COMPLETED',
      provisioning_attempts: 1,
      sync_status: 'IN_SYNC',
      sync_details: { last_activity: new Date().toISOString() },
      media_server_policy: { ...server.default_policy },
      is_active: true,
      last_sync_at: new Date().toISOString(),
      last_provisioned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newMapping, ...all.filter(m => m.id !== existing?.id)];
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
    return newMapping;
  }

  disableMapping(id: string, reason = 'Disabled by admin'): MediaAccountMapping {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          is_active: false,
          provisioning_status: 'DISABLED' as ProvisioningStatus,
          disabled_at: new Date().toISOString(),
          disabled_reason: reason,
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
    return updated.find(m => m.id === id)!;
  }

  enableMapping(id: string): MediaAccountMapping {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          is_active: true,
          provisioning_status: 'COMPLETED' as ProvisioningStatus,
          disabled_at: null,
          disabled_reason: null,
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
    return updated.find(m => m.id === id)!;
  }

  deleteMapping(id: string, reason = 'Deleted by admin'): void {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          is_active: false,
          provisioning_status: 'DELETED' as ProvisioningStatus,
          disabled_reason: reason,
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
  }

  resetPassword(id: string): { newPassword: string; username: string; serverName: string } {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const mapping = all.find(m => m.id === id);
    if (!mapping) throw new Error('Mapping not found');

    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let newPassword = '';
    for (let i = 0; i < 18; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          has_stored_password: true,
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);

    return {
      newPassword,
      username: mapping.external_username,
      serverName: mapping.media_server_name
    };
  }

  applyPolicy(id: string, override?: Record<string, any>): MediaAccountMapping {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          media_server_policy: {
            ...m.media_server_policy,
            ...(override || {}),
            last_applied: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
    return updated.find(m => m.id === id)!;
  }

  syncMapping(id: string): MediaAccountMapping {
    const all = this.getStorage<MediaAccountMapping[]>(STORAGE_KEYS.MAPPINGS, INITIAL_MAPPINGS);
    const updated = all.map(m => {
      if (m.id === id) {
        return {
          ...m,
          sync_status: 'IN_SYNC' as MediaSyncStatus,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return m;
    });
    this.setStorage(STORAGE_KEYS.MAPPINGS, updated);
    return updated.find(m => m.id === id)!;
  }

  // ================= Sync Operations =================
  triggerServerSync(serverId: string, syncType: 'FULL' | 'INCREMENTAL' | 'RECONCILIATION'): MediaServerUserSync {
    const servers = this.getServers();
    const server = servers.find(s => s.id === serverId) || servers[0];
    const syncs = this.getStorage<MediaServerUserSync[]>(STORAGE_KEYS.SYNCS, INITIAL_SYNCS);
    const mappings = this.getMappings({ media_server_id: serverId });

    const newSync: MediaServerUserSync = {
      id: `sync-${Date.now()}`,
      media_server: server.id,
      media_server_name: server.name,
      sync_type: syncType,
      status: 'COMPLETED',
      started_at: new Date().toISOString(),
      completed_at: new Date(Date.now() + 2500).toISOString(),
      users_checked: mappings.length + 1,
      users_created: 0,
      users_updated: mappings.length,
      users_disabled: mappings.filter(m => !m.is_active).length,
      users_deleted: 0,
      mappings_fixed: 0,
      orphans_found: 1,
      conflicts_found: 0,
      triggered_by: 'MANUAL',
      triggered_by_username: 'admin',
      correlation_id: `corr-${Date.now()}`,
    };

    const updatedSyncs = [newSync, ...syncs];
    this.setStorage(STORAGE_KEYS.SYNCS, updatedSyncs);

    // Also update server timestamp
    const updatedServers = servers.map(s => {
      if (s.id === serverId) {
        return {
          ...s,
          last_user_sync_at: new Date().toISOString(),
          last_full_sync_at: syncType === 'FULL' ? new Date().toISOString() : s.last_full_sync_at
        };
      }
      return s;
    });
    this.setStorage(STORAGE_KEYS.SERVERS, updatedServers);

    return newSync;
  }

  getSyncHistory(serverId?: string): MediaServerUserSync[] {
    const syncs = this.getStorage<MediaServerUserSync[]>(STORAGE_KEYS.SYNCS, INITIAL_SYNCS);
    if (serverId) {
      return syncs.filter(s => s.media_server === serverId);
    }
    return syncs;
  }

  // ================= Orphans =================
  getOrphans(serverId?: string, status?: string): MediaServerOrphanUser[] {
    let orphans = this.getStorage<MediaServerOrphanUser[]>(STORAGE_KEYS.ORPHANS, INITIAL_ORPHANS);
    if (serverId) {
      orphans = orphans.filter(o => o.media_server === serverId);
    }
    if (status) {
      orphans = orphans.filter(o => o.status === status);
    }
    return orphans;
  }

  claimOrphan(orphanId: string, user: { id: string; username: string; lounge_id: string }): MediaAccountMapping {
    const orphans = this.getOrphans();
    const orphan = orphans.find(o => o.id === orphanId);
    if (!orphan) throw new Error('Orphan account not found');

    const mapping: MediaAccountMapping = {
      id: `map-claim-${Date.now()}`,
      media_server: orphan.media_server,
      media_server_name: orphan.media_server_name,
      media_server_url: orphan.media_server.includes('emby') ? 'http://192.168.1.120:8096' : 'http://192.168.1.110:8096',
      server_type: orphan.media_server.includes('emby') ? 'emby' : 'jellyfin',
      user: user.id,
      user_username: user.username,
      user_lounge_id: user.lounge_id,
      external_user_id: orphan.external_user_id,
      external_username: orphan.external_username,
      has_stored_password: false,
      provisioning_mode: 'MANUAL',
      provisioning_status: 'COMPLETED',
      provisioning_attempts: 1,
      sync_status: 'IN_SYNC',
      is_active: true,
      last_sync_at: new Date().toISOString(),
      last_provisioned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const allMappings = this.getMappings();
    this.setStorage(STORAGE_KEYS.MAPPINGS, [mapping, ...allMappings]);

    const updatedOrphans = orphans.map(o => {
      if (o.id === orphanId) {
        return {
          ...o,
          status: 'CLAIMED' as const,
          claimed_by_user: user.id,
          claimed_by_username: user.username,
          claimed_at: new Date().toISOString(),
          resolved_by_username: 'admin',
          resolution_note: `Claimed to ${user.username} (${user.lounge_id})`
        };
      }
      return o;
    });
    this.setStorage(STORAGE_KEYS.ORPHANS, updatedOrphans);

    return mapping;
  }

  ignoreOrphan(orphanId: string, note = 'Ignored by admin'): void {
    const orphans = this.getOrphans();
    const updated = orphans.map(o => {
      if (o.id === orphanId) {
        return {
          ...o,
          status: 'IGNORED' as const,
          resolution_note: note,
          resolved_by_username: 'admin'
        };
      }
      return o;
    });
    this.setStorage(STORAGE_KEYS.ORPHANS, updated);
  }

  deleteOrphan(orphanId: string): void {
    const orphans = this.getOrphans();
    const updated = orphans.map(o => {
      if (o.id === orphanId) {
        return {
          ...o,
          status: 'DELETED' as const,
          resolution_note: 'Deleted from media server by admin',
          resolved_by_username: 'admin'
        };
      }
      return o;
    });
    this.setStorage(STORAGE_KEYS.ORPHANS, updated);
  }

  // ================= Servers Config =================
  getServers(): ProvisioningConfig[] {
    return this.getStorage<ProvisioningConfig[]>(STORAGE_KEYS.SERVERS, INITIAL_SERVERS);
  }

  updateServerConfig(serverId: string, config: Partial<ProvisioningConfig>): ProvisioningConfig {
    const servers = this.getServers();
    const updated = servers.map(s => {
      if (s.id === serverId) {
        return { ...s, ...config };
      }
      return s;
    });
    this.setStorage(STORAGE_KEYS.SERVERS, updated);
    return updated.find(s => s.id === serverId)!;
  }

  // ================= Dashboard & Metrics =================
  getDashboardMetrics(serverId?: string): ProvisioningDashboardMetrics {
    const mappings = this.getMappings({ media_server_id: serverId }).filter(m => m.provisioning_status !== 'DELETED');
    const orphans = this.getOrphans(serverId).filter(o => o.status === 'NEW');
    const syncs = this.getSyncHistory(serverId);

    const total = mappings.length;
    const completed = mappings.filter(m => m.provisioning_status === 'COMPLETED').length;
    const failed = mappings.filter(m => m.provisioning_status === 'FAILED').length;
    const pending = mappings.filter(m => m.provisioning_status === 'PENDING' || m.provisioning_status === 'IN_PROGRESS').length;
    const disabled = mappings.filter(m => m.provisioning_status === 'DISABLED' || !m.is_active).length;
    const in_sync = mappings.filter(m => m.sync_status === 'IN_SYNC').length;
    const out_of_sync = mappings.filter(m => m.sync_status === 'OUT_OF_SYNC' || m.sync_status === 'ERROR').length;

    const considered = completed + failed;
    const success_rate = considered > 0 ? Math.round((completed / considered) * 100) : 100;

    let health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (success_rate < 80 || out_of_sync > 2) {
      health = 'UNHEALTHY';
    } else if (success_rate < 95 || out_of_sync > 0 || orphans.length > 0) {
      health = 'DEGRADED';
    }

    const lastSync = syncs[0];

    return {
      health_status: health,
      success_rate,
      total_mappings: total,
      completed,
      failed,
      pending,
      disabled,
      in_sync,
      out_of_sync,
      active_orphans: orphans.length,
      last_sync_at: lastSync?.started_at,
      last_sync_status: lastSync?.status,
    };
  }

  // ================= Bulk Operations =================
  bulkProvision(users: Array<{ id: string; username: string; lounge_id: string }>, serverId: string) {
    const successes = [];
    for (const u of users) {
      try {
        const m = this.provisionUser(u, serverId);
        successes.push(m);
      } catch (e) {
        console.error(e);
      }
    }
    return { total: users.length, created: successes.length, successes };
  }

  bulkDisable(ids: string[], reason = 'Bulk admin disable') {
    ids.forEach(id => this.disableMapping(id, reason));
    return { count: ids.length };
  }

  bulkApplyPolicy(ids: string[], policyOverride?: Record<string, any>) {
    ids.forEach(id => this.applyPolicy(id, policyOverride));
    return { count: ids.length };
  }
}

export const mediaAccountEngine = new MediaAccountEngine();
