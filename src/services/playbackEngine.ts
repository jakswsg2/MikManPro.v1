import {
  MediaItem,
  LoungeUser,
  Device,
  PlaybackToken,
  PlaybackSession,
  WatchHistory,
  PlaybackStartRequest,
  PlaybackStartResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  ExternalPlayerLaunchRequest,
  ExternalPlayerLaunchResponse,
  PlaybackMethod,
  AuditLogEntry
} from '../types';
import { INITIAL_MEDIA_ITEMS } from '../data/initialData';

// Storage keys
const WATCH_HISTORY_KEY = 'smart_lounge_watch_history_v1';
const PLAYBACK_SESSIONS_KEY = 'smart_lounge_playback_sessions_v1';
const PLAYBACK_TOKENS_KEY = 'smart_lounge_tokens_v1';

/**
 * PlaybackTokenService
 * Issues, hashes, validates, and revokes secure, short-lived playback tokens.
 */
export class PlaybackTokenService {
  private static TTL_SECONDS = 300; // 5 minutes default

  static generateToken(
    user: LoungeUser,
    mediaItem: MediaItem,
    device: Device,
    scope: 'WEB' | 'EXTERNAL' | 'CAST' | 'DOWNLOAD' = 'WEB'
  ): { token: string; tokenObj: PlaybackToken } {
    const rawToken = `slt_${Math.random().toString(36).substring(2)}_${Date.now()}_${user.id.substring(0, 4)}`;
    // SHA-256 simulation
    const tokenHash = `sha256_${btoa(rawToken).replace(/=/g, '').substring(0, 32)}`;
    const now = new Date();
    const expires = new Date(now.getTime() + this.TTL_SECONDS * 1000);

    const tokenObj: PlaybackToken = {
      id: `ptk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      token_hash: tokenHash,
      user_id: user.id,
      profile_id: user.active_profile?.id,
      device_id: device.id,
      media_item_id: mediaItem.id,
      media_server_id: mediaItem.server_id,
      external_playback_id: `ext-play-${mediaItem.external_id || mediaItem.id}`,
      scope,
      ip_address: user.ip_address || '10.0.0.124',
      user_agent: navigator.userAgent || 'SmartLoungeWeb/1.0',
      issued_at: now.toISOString(),
      expires_at: expires.toISOString(),
      max_uses: 5,
      current_uses: 1,
    };

    // Store in active registry
    this.saveToken(tokenObj);

    return { token: rawToken, tokenObj };
  }

  static getActiveTokens(): PlaybackToken[] {
    try {
      const data = localStorage.getItem(PLAYBACK_TOKENS_KEY);
      if (!data) return [];
      const tokens: PlaybackToken[] = JSON.parse(data);
      const now = new Date().getTime();
      return tokens.filter(t => !t.revoked_at && new Date(t.expires_at).getTime() > now);
    } catch {
      return [];
    }
  }

  static saveToken(token: PlaybackToken) {
    const tokens = this.getActiveTokens();
    tokens.unshift(token);
    localStorage.setItem(PLAYBACK_TOKENS_KEY, JSON.stringify(tokens.slice(0, 50)));
  }

  static revokeToken(tokenId: string, reason = 'User initiated') {
    const tokens = this.getActiveTokens();
    const updated = tokens.map(t => {
      if (t.id === tokenId) {
        return { ...t, revoked_at: new Date().toISOString(), revoke_reason: reason };
      }
      return t;
    });
    localStorage.setItem(PLAYBACK_TOKENS_KEY, JSON.stringify(updated));
  }
}

/**
 * ConcurrentSessionsService (Anti-Sharing)
 * Enforces concurrent session limits per profile and handles eviction policies.
 */
export class ConcurrentSessionsService {
  static checkLimit(user: LoungeUser, device: Device): {
    allowed: boolean;
    current_count: number;
    max_allowed: number;
    action: 'ALLOW' | 'REJECT' | 'CLOSE_OLDEST';
    oldest_session?: PlaybackSession;
  } {
    const maxAllowed = user.active_profile?.max_concurrent_sessions || 2;
    const activeSessions = this.getActiveSessionsForUser(user.id);
    const count = activeSessions.length;

    if (count < maxAllowed) {
      return { allowed: true, current_count: count, max_allowed: maxAllowed, action: 'ALLOW' };
    }

    // Identify oldest active session
    const sorted = [...activeSessions].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );
    const oldest = sorted[0];

    return {
      allowed: false,
      current_count: count,
      max_allowed: maxAllowed,
      action: 'CLOSE_OLDEST',
      oldest_session: oldest,
    };
  }

  static getActiveSessions(): PlaybackSession[] {
    try {
      const data = localStorage.getItem(PLAYBACK_SESSIONS_KEY);
      if (!data) return [];
      const list: PlaybackSession[] = JSON.parse(data);
      // active if status is PLAYING or PAUSED and heartbeat is within last 90 seconds
      const threshold = Date.now() - 90 * 1000;
      return list.filter(
        s => (s.status === 'PLAYING' || s.status === 'PAUSED' || s.status === 'STARTING') &&
             new Date(s.last_heartbeat_at).getTime() > threshold
      );
    } catch {
      return [];
    }
  }

  static getActiveSessionsForUser(userId: string): PlaybackSession[] {
    return this.getActiveSessions().filter(s => s.user_id === userId);
  }

  static terminateSession(sessionId: string) {
    const all = this.getAllSessions();
    const updated = all.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: 'STOPPED' as const, ended_at: new Date().toISOString() };
      }
      return s;
    });
    localStorage.setItem(PLAYBACK_SESSIONS_KEY, JSON.stringify(updated));
  }

  static getAllSessions(): PlaybackSession[] {
    try {
      const data = localStorage.getItem(PLAYBACK_SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}

/**
 * SignedURLService
 * Delivers obfuscated, signed playback endpoints without exposing Jellyfin/Emby IPs or API keys.
 */
export class SignedURLService {
  static buildStreamUrl(token: string, quality?: string): string {
    const base = '/api/v1/playback/stream';
    const params = new URLSearchParams({ token });
    if (quality) params.append('quality', quality);
    return `${base}?${params.toString()}`;
  }

  static buildManifestUrl(token: string): string {
    return `/api/v1/playback/manifest.m3u8?token=${token}`;
  }
}

/**
 * QualitySelector & TrackSelector
 */
export class QualitySelector {
  static select(user: LoungeUser, item: MediaItem, requestedQuality?: string): {
    selected: string;
    available: string[];
    method: PlaybackMethod;
    reason: string;
  } {
    const isVip = user.active_profile?.code === 'Premium' || user.active_profile?.code === 'Admin';
    const available = isVip
      ? ['4K UHD (DirectPlay)', '1080p FHD (DirectPlay)', '720p HD (DirectStream)', '480p (Transcode)']
      : ['1080p FHD (DirectPlay)', '720p HD (DirectStream)', '480p (Transcode)'];

    let selected = available[0];
    if (requestedQuality && available.includes(requestedQuality)) {
      selected = requestedQuality;
    }

    const method: PlaybackMethod = selected.includes('DirectPlay')
      ? 'DIRECT_PLAY'
      : selected.includes('DirectStream')
      ? 'DIRECT_STREAM'
      : 'TRANSCODE';

    return {
      selected,
      available,
      method,
      reason: isVip ? 'User profile has 4K Ultra HD privileges' : 'Standard 1080p profile allocated',
    };
  }
}

/**
 * WatchHistoryService
 * Tracks video position, resume capability, and completion status (>=90%).
 */
export class WatchHistoryService {
  static getHistory(): WatchHistory[] {
    try {
      const data = localStorage.getItem(WATCH_HISTORY_KEY);
      if (!data) {
        // Seed initial history item for demo
        const demoItem = INITIAL_MEDIA_ITEMS[0];
        const initial: WatchHistory[] = [
          {
            id: 'wh-seed-1',
            user_id: 'usr-101',
            media_item_id: demoItem.id,
            media_item: demoItem,
            position_seconds: 1425, // 23:45 minutes
            duration_seconds: (demoItem.duration_minutes || 120) * 60,
            completion_percentage: 20,
            is_completed: false,
            last_watched_at: new Date(Date.now() - 3600000).toISOString(),
            first_watched_at: new Date(Date.now() - 86400000).toISOString(),
            watch_count: 2,
          }
        ];
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(initial));
        return initial;
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static getResumePosition(userId: string, mediaItemId: string): WatchHistory | null {
    const history = this.getHistory();
    const entry = history.find(h => h.user_id === userId && h.media_item_id === mediaItemId);
    if (!entry || entry.is_completed) return null;
    return entry;
  }

  static saveProgress(
    user: LoungeUser,
    item: MediaItem,
    positionSeconds: number,
    durationSeconds: number
  ): WatchHistory {
    const history = this.getHistory();
    const duration = durationSeconds > 0 ? durationSeconds : (item.duration_minutes || 120) * 60;
    const percentage = Math.min(100, Math.round((positionSeconds / duration) * 100));
    const isCompleted = percentage >= 90;

    const existingIndex = history.findIndex(
      h => h.user_id === user.id && h.media_item_id === item.id
    );

    const now = new Date().toISOString();

    let entry: WatchHistory;
    if (existingIndex >= 0) {
      entry = {
        ...history[existingIndex],
        position_seconds: isCompleted ? 0 : positionSeconds,
        duration_seconds: duration,
        completion_percentage: percentage,
        is_completed: isCompleted,
        last_watched_at: now,
        watch_count: history[existingIndex].watch_count + 1,
      };
      history[existingIndex] = entry;
    } else {
      entry = {
        id: `wh-${Date.now()}`,
        user_id: user.id,
        profile_id: user.active_profile?.id,
        media_item_id: item.id,
        media_item: item,
        position_seconds: isCompleted ? 0 : positionSeconds,
        duration_seconds: duration,
        completion_percentage: percentage,
        is_completed: isCompleted,
        last_watched_at: now,
        first_watched_at: now,
        watch_count: 1,
      };
      history.unshift(entry);
    }

    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    return entry;
  }

  static getContinueWatching(userId: string): WatchHistory[] {
    const history = this.getHistory();
    return history.filter(h => h.user_id === userId && !h.is_completed && h.position_seconds > 60);
  }
}

/**
 * PlaybackApiService
 * Simulates the Django REST Framework Playback Endpoints:
 * - POST /api/v1/playback/start/
 * - POST /api/v1/playback/heartbeat/
 * - POST /api/v1/playback/stop/
 * - GET  /api/v1/playback/resume/
 * - GET  /api/v1/playback/continue-watching/
 * - POST /api/v1/playback/external/
 */
export class PlaybackApiService {
  static async startPlayback(
    user: LoungeUser,
    device: Device,
    request: PlaybackStartRequest
  ): Promise<{ response?: PlaybackStartResponse; error?: string; breachOldestSession?: PlaybackSession }> {
    // 1. Find Media Item
    const item = INITIAL_MEDIA_ITEMS.find(i => i.id === request.media_item_id);
    if (!item) {
      return { error: 'Media item not found in server libraries' };
    }

    // 2. Check Concurrent Limit (Anti-Sharing)
    const check = ConcurrentSessionsService.checkLimit(user, device);
    if (!check.allowed && check.action === 'CLOSE_OLDEST') {
      // Return breach info so UI can prompt or auto-evict
      return {
        error: `CONCURRENT_LIMIT_EXCEEDED`,
        breachOldestSession: check.oldest_session,
      };
    }

    // 3. Issue Token
    const { token, tokenObj } = PlaybackTokenService.generateToken(user, item, device, request.scope || 'WEB');

    // 4. Determine Quality & Method
    const qualityInfo = QualitySelector.select(user, item, request.quality);

    // 5. Create Playback Session
    const duration = (item.duration_minutes || 118) * 60;
    const resumeEntry = request.resume ? WatchHistoryService.getResumePosition(user.id, item.id) : null;
    const resumePos = resumeEntry ? resumeEntry.position_seconds : 0;

    const session: PlaybackSession = {
      id: `psess-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: user.id,
      user_lounge_id: user.lounge_id,
      user_full_name: user.full_name,
      profile_name: user.active_profile?.name || 'General',
      device_id: device.id,
      device_name: device.device_name,
      media_item_id: item.id,
      media_item_title: item.title,
      media_item_poster: item.poster_url,
      media_server_name: item.library_name || 'Lounge Media 01',
      external_playback_id: tokenObj.external_playback_id,
      playback_method: qualityInfo.method,
      status: 'PLAYING',
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      position_seconds: resumePos,
      duration_seconds: duration,
      watched_seconds: 0,
      playback_rate: 1.0,
      resolution: qualityInfo.selected,
      audio_track: item.audio_languages[0] || 'عربي (دبلجة)',
      subtitle_track: item.subtitle_languages[0] || 'العربية',
      client_ip: user.ip_address || '10.0.0.124',
      bitrate_mbps: qualityInfo.selected.includes('4K') ? 24.5 : 12.0,
      correlation_id: `corr-${Math.random().toString(36).substring(2, 10)}`,
    };

    // Save session
    const allSessions = ConcurrentSessionsService.getAllSessions();
    allSessions.unshift(session);
    localStorage.setItem(PLAYBACK_SESSIONS_KEY, JSON.stringify(allSessions.slice(0, 50)));

    // Return PlaybackStartResponse
    return {
      response: {
        playback_session_id: session.id,
        token,
        manifest_url: SignedURLService.buildManifestUrl(token),
        stream_url: SignedURLService.buildStreamUrl(token, qualityInfo.selected),
        resume_position: resumePos,
        duration,
        quality: qualityInfo.selected,
        playback_method: qualityInfo.method,
        audio_tracks: item.audio_languages,
        subtitle_tracks: item.subtitle_languages,
        available_qualities: qualityInfo.available,
        delivery_node: 'Node-01 (10.0.0.50 LAN DirectStream)',
      }
    };
  }

  static async sendHeartbeat(req: HeartbeatRequest): Promise<HeartbeatResponse> {
    const all = ConcurrentSessionsService.getAllSessions();
    const sessionIndex = all.findIndex(s => s.id === req.playback_session_id);

    if (sessionIndex === 0 || sessionIndex > 0) {
      const s = all[sessionIndex];
      s.last_heartbeat_at = new Date().toISOString();
      s.position_seconds = req.position_seconds;
      s.status = req.status;
      if (req.playback_rate) s.playback_rate = req.playback_rate;
      s.watched_seconds += 30; // increments by heartbeat duration
      localStorage.setItem(PLAYBACK_SESSIONS_KEY, JSON.stringify(all));

      if (s.status === 'STOPPED') {
        return { should_stop: true, stop_reason: 'Session was terminated remotely by user or administrator' };
      }
    }

    return {
      should_stop: false,
      next_token: null,
    };
  }

  static async stopPlayback(sessionId: string, finalPosition: number, item: MediaItem, user: LoungeUser): Promise<void> {
    ConcurrentSessionsService.terminateSession(sessionId);
    WatchHistoryService.saveProgress(user, item, finalPosition, (item.duration_minutes || 118) * 60);
  }

  static async launchExternalPlayer(
    user: LoungeUser,
    device: Device,
    req: ExternalPlayerLaunchRequest
  ): Promise<ExternalPlayerLaunchResponse> {
    const item = INITIAL_MEDIA_ITEMS.find(i => i.id === req.media_item_id)!;
    const { token } = PlaybackTokenService.generateToken(user, item, device, 'EXTERNAL');
    const rawStreamUrl = `${window.location.origin}/api/v1/playback/stream?token=${token}&direct=true`;

    let launchUrl = rawStreamUrl;
    let instructions = 'انسخ الرابط المؤقت وشغله في مشغل الوسائط المفضل لديك';

    switch (req.player_type) {
      case 'vlc':
        launchUrl = `vlc://${rawStreamUrl}`;
        instructions = 'سيتم فتح تطبيق VLC تلقائياً وبدء البث المباشر بدقة كاملة بدون تحويل';
        break;
      case 'infuse':
        launchUrl = `infuse://open?url=${encodeURIComponent(rawStreamUrl)}`;
        instructions = 'سيتم فتح Infuse Pro لدعم تقنية Dolby Vision و Atmos';
        break;
      case 'kodi':
        launchUrl = `kodi://${rawStreamUrl}`;
        instructions = 'تشغيل عبر مركز وسائط Kodi المنزلي';
        break;
      case 'mxplayer':
        launchUrl = `intent:${rawStreamUrl}#Intent;package=com.mxtech.videoplayer.ad;type=video/*;end`;
        instructions = 'تشغيل مباشر عبر MX Player للأندرويد';
        break;
    }

    return {
      launch_url: launchUrl,
      raw_stream_url: rawStreamUrl,
      token,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      instructions,
      player_name: req.player_type.toUpperCase(),
    };
  }
}
