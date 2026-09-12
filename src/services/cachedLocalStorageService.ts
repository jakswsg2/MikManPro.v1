/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaItem, WatchHistory } from '../types';
import { INITIAL_MEDIA_ITEMS } from '../data/initialData';

const CACHED_CATALOG_KEY = 'smart_lounge_cached_catalog_v1';
const CACHED_METADATA_KEY = 'smart_lounge_cached_metadata_v1';
const CACHED_HISTORY_KEY = 'smart_lounge_watch_history_v1';
const NETWORK_STATUS_KEY = 'smart_lounge_network_status_v1';
const CACHE_META_KEY = 'smart_lounge_cache_meta_v1';

export interface CacheMetadataInfo {
  last_cached_at: string;
  item_count: number;
  server_name: string;
  is_online: boolean;
  version: string;
}

/**
 * CachedLocalStorageService
 * Manages local storage caching for media items, recently watched items, and metadata
 * to allow browsing when the Jellyfin/Emby server is unreachable on the local network.
 */
export class CachedLocalStorageService {
  /**
   * Cache the entire media catalog from Jellyfin/Emby servers
   */
  static cacheCatalog(items: MediaItem[], serverName = 'Jellyfin LAN Server'): void {
    try {
      localStorage.setItem(CACHED_CATALOG_KEY, JSON.stringify(items));
      const meta: CacheMetadataInfo = {
        last_cached_at: new Date().toISOString(),
        item_count: items.length,
        server_name: serverName,
        is_online: this.isServerOnline(),
        version: '1.0.0',
      };
      localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
    } catch (e) {
      console.error('Failed to cache media catalog to localStorage:', e);
    }
  }

  /**
   * Retrieve cached media catalog. Falls back to INITIAL_MEDIA_ITEMS if empty.
   */
  static getCachedCatalog(): MediaItem[] {
    try {
      const data = localStorage.getItem(CACHED_CATALOG_KEY);
      if (!data) {
        // Initialize cache with INITIAL_MEDIA_ITEMS for robust offline experience
        this.cacheCatalog(INITIAL_MEDIA_ITEMS, 'Smart Lounge Default LAN');
        return INITIAL_MEDIA_ITEMS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to read cached catalog:', e);
      return INITIAL_MEDIA_ITEMS;
    }
  }

  /**
   * Cache item-specific metadata (cast, posters, subtitles, details)
   */
  static cacheMetadata(itemId: string, metadata: Record<string, any>): void {
    try {
      const existingData = localStorage.getItem(CACHED_METADATA_KEY);
      const metadataMap: Record<string, any> = existingData ? JSON.parse(existingData) : {};
      metadataMap[itemId] = {
        ...metadata,
        cached_at: new Date().toISOString(),
      };
      localStorage.setItem(CACHED_METADATA_KEY, JSON.stringify(metadataMap));
    } catch (e) {
      console.error('Failed to cache item metadata:', e);
    }
  }

  /**
   * Retrieve cached metadata for a specific media item
   */
  static getCachedMetadata(itemId: string): Record<string, any> | null {
    try {
      const data = localStorage.getItem(CACHED_METADATA_KEY);
      if (!data) return null;
      const metadataMap: Record<string, any> = JSON.parse(data);
      return metadataMap[itemId] || null;
    } catch {
      return null;
    }
  }

  /**
   * Cache watch history locally for offline resume capability
   */
  static cacheWatchHistory(history: WatchHistory[]): void {
    try {
      localStorage.setItem(CACHED_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to cache watch history:', e);
    }
  }

  /**
   * Retrieve cached watch history
   */
  static getCachedWatchHistory(): WatchHistory[] {
    try {
      const data = localStorage.getItem(CACHED_HISTORY_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Set network status (Online vs Unreachable / Offline LAN Mode)
   */
  static setServerOnline(isOnline: boolean, serverName = 'Jellyfin LAN 01'): void {
    try {
      const statusObj = {
        is_online: isOnline,
        last_checked: new Date().toISOString(),
        server_name: serverName,
      };
      localStorage.setItem(NETWORK_STATUS_KEY, JSON.stringify(statusObj));

      // Also update cache meta
      const metaData = localStorage.getItem(CACHE_META_KEY);
      if (metaData) {
        const meta: CacheMetadataInfo = JSON.parse(metaData);
        meta.is_online = isOnline;
        localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
      }
    } catch (e) {
      console.error('Failed to set network status:', e);
    }
  }

  /**
   * Check if local Jellyfin/Emby server is online
   */
  static isServerOnline(): boolean {
    try {
      const data = localStorage.getItem(NETWORK_STATUS_KEY);
      if (!data) return true; // Default to online
      const statusObj = JSON.parse(data);
      return !!statusObj.is_online;
    } catch {
      return true;
    }
  }

  /**
   * Get detailed cache stats for management and dashboard display
   */
  static getCacheStats(): {
    isOnline: boolean;
    lastCachedAt: string;
    itemCount: number;
    serverName: string;
    historyCount: number;
    storageSizeKb: number;
  } {
    let lastCachedAt = new Date().toISOString();
    let itemCount = INITIAL_MEDIA_ITEMS.length;
    let serverName = 'Jellyfin LAN 01 (192.168.1.50)';
    let isOnline = this.isServerOnline();
    let historyCount = 0;

    try {
      const metaData = localStorage.getItem(CACHE_META_KEY);
      if (metaData) {
        const meta: CacheMetadataInfo = JSON.parse(metaData);
        lastCachedAt = meta.last_cached_at;
        itemCount = meta.item_count;
        serverName = meta.server_name;
        isOnline = meta.is_online;
      }

      const historyData = localStorage.getItem(CACHED_HISTORY_KEY);
      if (historyData) {
        historyCount = JSON.parse(historyData).length;
      }
    } catch {}

    // Calculate approximate storage size
    let totalChars = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('smart_lounge_')) {
          totalChars += (localStorage.getItem(key) || '').length;
        }
      }
    } catch {}

    const storageSizeKb = Math.round((totalChars * 2) / 1024); // UTF-16 bytes approx

    return {
      isOnline,
      lastCachedAt,
      itemCount,
      serverName,
      historyCount,
      storageSizeKb,
    };
  }

  /**
   * Clear cached storage
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(CACHED_CATALOG_KEY);
      localStorage.removeItem(CACHED_METADATA_KEY);
      localStorage.removeItem(CACHED_HISTORY_KEY);
      localStorage.removeItem(CACHE_META_KEY);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  }
}
