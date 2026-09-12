import { DistributedTrace, BackupStatus } from '../types';

export const INITIAL_DISTRIBUTED_TRACES: DistributedTrace[] = [
  {
    trace_id: 'tr-9f8a3c4b12d5',
    correlation_id: 'corr-usr152-playback-4k',
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    user_id: 'usr-1 (LU-000152)',
    endpoint: '/api/v1/playback/sessions/start/',
    http_method: 'POST',
    status_code: 201,
    total_duration_ms: 48,
    spans: [
      {
        id: 'sp-1',
        name: 'Client Ingress & TLS Termination',
        service: 'API_GATEWAY',
        duration_ms: 4,
        status: 'SUCCESS',
        details: 'Nginx Reverse Proxy / SSL Handshake'
      },
      {
        id: 'sp-2',
        name: 'Identity & JWT Validation',
        service: 'DJANGO_CORE',
        duration_ms: 8,
        status: 'SUCCESS',
        details: 'User: sultan_vip (Profile: Premium)'
      },
      {
        id: 'sp-3',
        name: 'Hotspot Session & IP Verification',
        service: 'MIKROTIK_ROUTEROS',
        duration_ms: 7,
        status: 'SUCCESS',
        details: 'RouterOS API: Match 192.168.88.102 with radius user sultan_vip'
      },
      {
        id: 'sp-4',
        name: 'Rate Limit & Token Cache Check',
        service: 'REDIS_CACHE',
        duration_ms: 2,
        status: 'SUCCESS',
        details: 'Redis GET session:active:LU-000152'
      },
      {
        id: 'sp-5',
        name: 'Hybrid Permission Evaluation (RBAC+ABAC)',
        service: 'POSTGRES_PGVECTOR',
        duration_ms: 9,
        status: 'SUCCESS',
        details: 'Check permission: content.premium.view & RLS tenant isolation'
      },
      {
        id: 'sp-6',
        name: 'HMAC Token Generation & Media Server Dispatch',
        service: 'JELLYFIN_CONNECTOR',
        duration_ms: 18,
        status: 'SUCCESS',
        details: 'Jellyfin Alpha Node direct playback stream ticket granted'
      }
    ]
  },
  {
    trace_id: 'tr-e12b77a09c31',
    correlation_id: 'corr-search-vector-fhd',
    timestamp: new Date(Date.now() - 14 * 60000).toISOString(),
    user_id: 'usr-4 (LU-000412)',
    endpoint: '/api/v1/search/unified/?q=مغامرة+فضاء&type=semantic',
    http_method: 'GET',
    status_code: 200,
    total_duration_ms: 36,
    spans: [
      {
        id: 'sp-11',
        name: 'API Gateway Ingress',
        service: 'API_GATEWAY',
        duration_ms: 3,
        status: 'SUCCESS'
      },
      {
        id: 'sp-12',
        name: 'DRF Authentication & Tenant Scoping',
        service: 'DJANGO_CORE',
        duration_ms: 6,
        status: 'SUCCESS',
        details: 'Tenant: TNT-00001 (Al-Karam Lounge)'
      },
      {
        id: 'sp-13',
        name: 'Semantic Embedding Generation',
        service: 'POSTGRES_PGVECTOR',
        duration_ms: 19,
        status: 'SUCCESS',
        details: 'pgvector Cosine Distance Query on 1536-dim vectors'
      },
      {
        id: 'sp-14',
        name: 'FTS Trigram & Synonyms Ranking',
        service: 'POSTGRES_PGVECTOR',
        duration_ms: 8,
        status: 'SUCCESS',
        details: 'Arabic morphological stemming & weighted rank'
      }
    ]
  }
];

export const INITIAL_BACKUP_STATUS: BackupStatus = {
  last_snapshot_at: new Date(Date.now() - 18 * 60000).toISOString(),
  backup_strategy: '3-2-1 Strategy (3 Copies, 2 Media, 1 Off-site)',
  local_nvme_copy: true,
  nas_secondary_copy: true,
  encrypted_cloud_replica: true,
  rpo_minutes: 15,
  rto_minutes: 5,
  db_size_mb: 420.8,
  media_metadata_size_mb: 1840.5,
  last_restore_drill_status: 'PASSED'
};
