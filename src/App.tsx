/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/views/HomeView';
import { MoviesView } from './components/views/MoviesView';
import { SeriesView } from './components/views/SeriesView';
import { KidsZoneView } from './components/views/KidsZoneView';
import { UnifiedSearchView } from './components/views/UnifiedSearchView';
import { ProfileView } from './components/views/ProfileView';
import { SettingsView } from './components/views/SettingsView';
import { SessionsView } from './components/views/SessionsView';
import { BillingView } from './components/views/BillingView';
import { LiveTvView } from './components/views/LiveTvView';
import { RequestsAndSupportView } from './components/views/RequestsAndSupportView';
import { AIGatewayDashboard } from './components/ai/AIGatewayDashboard';
import { InfrastructureObservabilityDashboard } from './components/observability/InfrastructureObservabilityDashboard';
import { AdminBillingDashboard } from './components/billing/AdminBillingDashboard';
import { GracePeriodBanner } from './components/billing/GracePeriodBanner';
import { RedeemCardModal } from './components/billing/RedeemCardModal';
import { ContentDetailModal } from './components/streaming/ContentDetailModal';
import { PlaybackModal } from './components/streaming/PlaybackModal';
import { AuthModal } from './components/views/AuthModal';
import { AdminDevDrawer } from './components/AdminDevDrawer';

// Architecture & Dev Components (Phases 1-4)
import { EnterprisePermissionsDashboard } from './components/EnterprisePermissionsDashboard';
import { UserPermissionsManager } from './components/UserPermissionsManager';
import { NetworkGatewaysManager } from './components/NetworkGatewaysManager';
import { MediaServersManager } from './components/MediaServersManager';
import { ApiDocsViewer } from './components/ApiDocsViewer';
import { DjangoCodeViewer } from './components/DjangoCodeViewer';
import { PlaybackMonitoringTab } from './components/streaming/PlaybackMonitoringTab';
import { UserMediaAccountsView } from './components/media_accounts/UserMediaAccountsView';
import { AdminMediaAccountsManager } from './components/media_accounts/AdminMediaAccountsManager';
import { AdminSearchIntelligenceDashboard } from './components/search/AdminSearchIntelligenceDashboard';
import { SuperAdminTenantsView } from './components/tenancy/SuperAdminTenantsView';
import { RLSSandboxView } from './components/tenancy/RLSSandboxView';
import { ResumeModal } from './components/streaming/ResumeModal';
import { ExternalPlayerModal } from './components/streaming/ExternalPlayerModal';
import { ConcurrentLimitModal } from './components/streaming/ConcurrentLimitModal';
import { WatchHistoryService, ConcurrentSessionsService } from './services/playbackEngine';
import { CachedLocalStorageService } from './services/cachedLocalStorageService';
import { OfflineCacheStatusBanner } from './components/streaming/OfflineCacheStatusBanner';
import { WatchHistory, PlaybackSession } from './types';

import { 
  INITIAL_USERS, 
  INITIAL_PROFILES, 
  INITIAL_PERMISSIONS, 
  INITIAL_SERVERS, 
  INITIAL_MEDIA_ITEMS 
} from './data/initialData';
import { LoungeUser, MediaServer, MediaItem } from './types';
import { apiFetch } from './lib/apiClient';
import { Language, translations } from './lib/i18n';
import { ArrowRight, ArrowLeft, Shield, Layers, Server, Wifi, Terminal } from 'lucide-react';

export default function App() {
  const [language, setLanguage] = useState<Language>('ar');
  const t = translations[language];

  const [activeView, setActiveView] = useState<string>('home');
  const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null);
  const [permissionSubView, setPermissionSubView] = useState<'enterprise' | 'overrides'>('enterprise');

  const [users, setUsers] = useState<LoungeUser[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<LoungeUser>(INITIAL_USERS[0]); // User A (Basic)
  const [mediaServers, setMediaServers] = useState<MediaServer[]>(INITIAL_SERVERS);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(() => {
    return CachedLocalStorageService.getCachedCatalog();
  });

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/media-servers/')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('media servers unavailable')))
      .then((payload) => {
        if (mounted && Array.isArray(payload.results)) setMediaServers(payload.results);
      })
      .catch(() => {
        // Keep the standalone catalog when Django is unavailable.
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/content/items/')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('catalog unavailable')))
      .then((payload) => {
        if (mounted && Array.isArray(payload.results)) setMediaItems(payload.results);
      })
      .catch(() => {
        // Keep cached catalog only when Django is unavailable.
      });
    return () => { mounted = false; };
  }, []);

  const handleAddMediaServer = async (server: MediaServer) => {
    const response = await apiFetch('/api/v1/media-servers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    if (!response.ok) throw new Error('تعذر حفظ خادم الوسائط في Django');
    const saved = await response.json();
    setMediaServers((current) => [...current, saved]);
  };

  const handleUpdateMediaServer = async (server: MediaServer) => {
    const response = await apiFetch(`/api/v1/media-servers/${server.id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    });
    if (!response.ok) throw new Error('تعذر تحديث خادم الوسائط في Django');
    const updated = await response.json();
    setMediaServers((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const handleDeleteMediaServer = async (id: string) => {
    const response = await apiFetch(`/api/v1/media-servers/${id}/`, { method: 'DELETE' });
    if (!response.ok) throw new Error('تعذر حذف خادم الوسائط من Django');
    setMediaServers((current) => current.filter((item) => item.id !== id));
  };

  // Keep cache synchronized when mediaItems change
  useEffect(() => {
    if (mediaItems && mediaItems.length > 0) {
      CachedLocalStorageService.cacheCatalog(mediaItems);
    }
  }, [mediaItems]);

  // Modals state
  const [selectedDetailItem, setSelectedDetailItem] = useState<MediaItem | null>(null);
  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);
  const [initialPlaybackPosition, setInitialPlaybackPosition] = useState<number>(0);
  const [resumePrompt, setResumePrompt] = useState<{ item: MediaItem; history: WatchHistory } | null>(null);
  const [externalPlayerItem, setExternalPlayerItem] = useState<MediaItem | null>(null);
  const [concurrentLimitData, setConcurrentLimitData] = useState<{ item: MediaItem; oldestSession?: PlaybackSession } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDevDrawerOpen, setIsDevDrawerOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  // Synchronize HTML dir attribute
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const handleInitiatePlayback = (item: MediaItem, directResumePosition?: number) => {
    // 1. Check Concurrent Sessions limit
    const activeSessions = ConcurrentSessionsService.getActiveSessionsForUser(currentUser.id);
    const maxAllowed = currentUser.active_profile?.max_concurrent_sessions || 2;

    if (activeSessions.length >= maxAllowed) {
      setConcurrentLimitData({
        item,
        oldestSession: activeSessions[0],
      });
      return;
    }

    // 2. If direct position provided (e.g. from ContinueWatchingRow)
    if (directResumePosition !== undefined) {
      setInitialPlaybackPosition(directResumePosition);
      setPlayingItem(item);
      return;
    }

    // 3. Check if previous watch history exists
    const history = WatchHistoryService.getResumePosition(currentUser.id, item.id);
    if (history && history.position_seconds > 10 && !history.is_completed) {
      setResumePrompt({ item, history });
      return;
    }

    // 4. Default start from beginning
    setInitialPlaybackPosition(0);
    setPlayingItem(item);
  };

  const [isLanOnline, setIsLanOnline] = useState(CachedLocalStorageService.isServerOnline());

  const handleUpdateUser = (updatedUser: LoungeUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
  };

  const handleSwitchToVIP = () => {
    const vipUser = users.find((u) => u.active_profile?.code === 'Premium' || u.username === 'sultan_vip' || u.username === 'user_b') || users[1];
    if (vipUser) {
      setCurrentUser(vipUser);
      if (selectedDetailItem) {
        // refresh detail modal item
        setSelectedDetailItem({ ...selectedDetailItem });
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950" 
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Top Navigation */}
      <Navbar
        activeView={activeSystemTab ? 'dev' : activeView}
        setActiveView={(view) => {
          setActiveSystemTab(null);
          setActiveView(view);
        }}
        currentUser={currentUser}
        language={language}
        onLanguageChange={setLanguage}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenDevDrawer={() => setIsDevDrawerOpen(true)}
        onOpenTenantsManagement={() => setActiveSystemTab('tenants')}
        onOpenRLSSandbox={() => setActiveSystemTab('rls-sandbox')}
        onLogout={() => setIsAuthModalOpen(true)}
        t={t}
      />

      {/* Grace Period & Expiration Alert Banner */}
      <GracePeriodBanner
        currentUser={currentUser}
        t={(k) => (t as any)[k] || k}
        onOpenRedeem={() => setIsRedeemModalOpen(true)}
        onOpenPlans={() => {
          setActiveSystemTab(null);
          setActiveView('billing');
        }}
      />

      {/* Offline Cache Status Banner */}
      <OfflineCacheStatusBanner onStatusChange={(online) => setIsLanOnline(online)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Backend & Dev System Views (If selected via Dev Drawer) */}
        {activeSystemTab ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSystemTab(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 text-xs font-bold transition-colors"
                >
                  {language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  <span>{t.backToPortal}</span>
                </button>
                <div className="text-xs">
                  <span className="font-bold text-white block">وضع فحص وتطوير الأنظمة الخلفية (Backend &amp; Dev Mode)</span>
                  <span className="text-slate-400 font-mono">Microservices, RBAC Matrix &amp; Gateway Simulation</span>
                </div>
              </div>
            </div>

            {activeSystemTab === 'billing' && (
              <AdminBillingDashboard currentUser={currentUser} t={(k) => (t as any)[k] || k} />
            )}

            {activeSystemTab === 'playback' && (
              <PlaybackMonitoringTab currentUser={currentUser} t={t} />
            )}

            {activeSystemTab === 'permissions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPermissionSubView('enterprise')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        permissionSubView === 'enterprise'
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      المحرك الهجين والشامل (Decision 59 &amp; 38)
                    </button>

                    <button
                      onClick={() => setPermissionSubView('overrides')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        permissionSubView === 'overrides'
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      إدارة بروفايلات واستثناءات المستخدمين (Decision 12)
                    </button>
                  </div>

                  <div className="text-xs text-slate-400 hidden sm:flex items-center gap-2 font-mono">
                    <span>المستخدم المحدد:</span>
                    <span className="text-amber-400 font-bold">{currentUser.full_name} ({currentUser.lounge_id})</span>
                  </div>
                </div>

                {permissionSubView === 'enterprise' ? (
                  <EnterprisePermissionsDashboard
                    users={users}
                    profiles={INITIAL_PROFILES}
                    permissions={INITIAL_PERMISSIONS}
                    mediaItems={mediaItems}
                    selectedUser={currentUser}
                    onSelectUser={(u) => setCurrentUser(u)}
                    onUpdateUser={handleUpdateUser}
                  />
                ) : (
                  <UserPermissionsManager
                    users={users}
                    profiles={INITIAL_PROFILES}
                    permissions={INITIAL_PERMISSIONS}
                    selectedUser={currentUser}
                    onSelectUser={(u) => setCurrentUser(u)}
                    onUpdateUser={handleUpdateUser}
                  />
                )}
              </div>
            )}

            {activeSystemTab === 'gateways' && (
              <NetworkGatewaysManager />
            )}

            {activeSystemTab === 'servers' && (
              <MediaServersManager
                servers={mediaServers}
                onAddServer={handleAddMediaServer}
                onUpdateServer={handleUpdateMediaServer}
                onDeleteServer={handleDeleteMediaServer}
              />
            )}

            {activeSystemTab === 'ai-gateway' && (
              <AIGatewayDashboard />
            )}

            {activeSystemTab === 'observability' && (
              <InfrastructureObservabilityDashboard />
            )}

            {activeSystemTab === 'media-accounts' && (
              <AdminMediaAccountsManager onBack={() => setActiveSystemTab(null)} />
            )}

            {activeSystemTab === 'search-admin' && (
              <AdminSearchIntelligenceDashboard />
            )}

            {activeSystemTab === 'tenants' && (
              <SuperAdminTenantsView currentUser={currentUser} />
            )}

            {activeSystemTab === 'rls-sandbox' && (
              <RLSSandboxView currentUser={currentUser} />
            )}

            {activeSystemTab === 'api' && (
              <ApiDocsViewer currentUser={currentUser} />
            )}

            {activeSystemTab === 'code' && (
              <DjangoCodeViewer />
            )}
          </div>
        ) : (
          /* Main User Streaming Views (Phase 5) */
          <>
            {activeView === 'home' && (
              <HomeView
                mediaItems={mediaItems}
                currentUser={currentUser}
                t={t}
                onSelect={(item) => setSelectedDetailItem(item)}
                onPlay={(item, pos) => handleInitiatePlayback(item, pos)}
                isLanOnline={isLanOnline}
              />
            )}

            {activeView === 'movies' && (
              <MoviesView
                mediaItems={mediaItems}
                currentUser={currentUser}
                t={t}
                onSelect={(item) => setSelectedDetailItem(item)}
                onPlay={(item) => handleInitiatePlayback(item)}
              />
            )}

            {activeView === 'series' && (
              <SeriesView
                mediaItems={mediaItems}
                currentUser={currentUser}
                t={t}
                onSelect={(item) => setSelectedDetailItem(item)}
                onPlay={(item) => handleInitiatePlayback(item)}
              />
            )}

            {activeView === 'livetv' && (
              <LiveTvView
                currentUser={currentUser}
                t={t}
              />
            )}

            {activeView === 'requests' && (
              <RequestsAndSupportView
                currentUser={currentUser}
                t={t}
              />
            )}

            {activeView === 'kids' && (
              <KidsZoneView
                mediaItems={mediaItems}
                currentUser={currentUser}
                t={t}
                onSelect={(item) => setSelectedDetailItem(item)}
                onPlay={(item) => handleInitiatePlayback(item)}
              />
            )}

            {activeView === 'search' && (
              <UnifiedSearchView
                mediaItems={mediaItems}
                currentUser={currentUser}
                t={t}
                onSelect={(item) => setSelectedDetailItem(item)}
                onPlay={(item) => handleInitiatePlayback(item)}
              />
            )}

            {activeView === 'billing' && (
              <BillingView
                currentUser={currentUser}
                t={t}
                onUpgradeToVIP={handleSwitchToVIP}
              />
            )}

            {activeView === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                t={t}
                onLogout={() => setIsAuthModalOpen(true)}
                onUpgradeToVIP={handleSwitchToVIP}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                language={language}
                onLanguageChange={setLanguage}
                t={t}
              />
            )}

            {activeView === 'sessions' && (
              <SessionsView
                currentUser={currentUser}
                t={t}
              />
            )}

            {activeView === 'media-accounts' && (
              <UserMediaAccountsView
                currentUserId={currentUser.id}
                currentUsername={currentUser.username}
                currentLoungeId={currentUser.lounge_id}
              />
            )}
          </>
        )}
      </main>

      {/* Content Detail Modal */}
      {selectedDetailItem && (
        <ContentDetailModal
          item={selectedDetailItem}
          currentUser={currentUser}
          t={t}
          onClose={() => setSelectedDetailItem(null)}
          onPlay={(item) => {
            setSelectedDetailItem(null);
            handleInitiatePlayback(item);
          }}
          onOpenExternalPlayer={(item) => {
            setSelectedDetailItem(null);
            setExternalPlayerItem(item);
          }}
          onUpgradeToVIP={handleSwitchToVIP}
        />
      )}

      {/* Video Playback Modal */}
      {playingItem && (
        <PlaybackModal
          item={playingItem}
          currentUser={currentUser}
          initialPosition={initialPlaybackPosition}
          t={t}
          onClose={() => {
            setPlayingItem(null);
            setInitialPlaybackPosition(0);
          }}
        />
      )}

      {/* Resume Modal */}
      {resumePrompt && (
        <ResumeModal
          item={resumePrompt.item}
          history={resumePrompt.history}
          t={t}
          onConfirmResume={() => {
            const pos = resumePrompt.history.position_seconds;
            const itm = resumePrompt.item;
            setResumePrompt(null);
            setInitialPlaybackPosition(pos);
            setPlayingItem(itm);
          }}
          onStartOver={() => {
            const itm = resumePrompt.item;
            setResumePrompt(null);
            setInitialPlaybackPosition(0);
            setPlayingItem(itm);
          }}
          onCancel={() => setResumePrompt(null)}
        />
      )}

      {/* External Player Modal */}
      {externalPlayerItem && (
        <ExternalPlayerModal
          item={externalPlayerItem}
          currentUser={currentUser}
          t={t}
          onClose={() => setExternalPlayerItem(null)}
        />
      )}

      {/* Concurrent Limit Modal */}
      {concurrentLimitData && (
        <ConcurrentLimitModal
          user={currentUser}
          oldestSession={concurrentLimitData.oldestSession}
          t={t}
          onEvictOldestAndPlay={() => {
            const item = concurrentLimitData.item;
            setConcurrentLimitData(null);
            handleInitiatePlayback(item);
          }}
          onCancel={() => setConcurrentLimitData(null)}
        />
      )}

      {/* Redeem Card Modal (Global) */}
      {isRedeemModalOpen && (
        <RedeemCardModal
          currentUser={currentUser}
          t={(k) => (t as any)[k] || k}
          onClose={() => setIsRedeemModalOpen(false)}
          onSuccess={() => {
            // Trigger update
            setUsers([...users]);
          }}
        />
      )}

      {/* Auth & Voucher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (!users.some((u) => u.id === user.id)) {
            setUsers((prev) => [user, ...prev]);
          }
        }}
        t={t}
        allUsers={users}
      />

      {/* Developer & Admin Drawer */}
      <AdminDevDrawer
        isOpen={isDevDrawerOpen}
        onClose={() => setIsDevDrawerOpen(false)}
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={(user) => {
          setCurrentUser(user);
          if (selectedDetailItem) setSelectedDetailItem({ ...selectedDetailItem });
        }}
        onOpenSystemTab={(tab) => {
          setActiveSystemTab(tab);
          setIsDevDrawerOpen(false);
        }}
        activeSystemTab={activeSystemTab}
        t={t}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/80 py-6 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              SL
            </div>
            <div>
              <span className="text-slate-200 font-semibold">{t.appName}</span>
              <span className="text-slate-500 mx-1.5">•</span>
              <span className="text-slate-400">بوابة موحدة داخل شبكة LAN لربط MikroTik بخوادم الوسائط Jellyfin / Emby</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Django 5.1 REST API</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span>LAN DirectPlay</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>RBAC Engine</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
