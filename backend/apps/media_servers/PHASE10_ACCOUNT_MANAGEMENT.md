# Phase 10: Media Server Account Management (Jellyfin / Emby)
**Smart Lounge Architecture Decision 11 & Decision 18 Implementation**

## 1. Overview
Phase 10 provides comprehensive, bidirectional account lifecycle management between **Smart Lounge identities** (User, LoungeID, Entitlements, Roles) and **Media Servers** (Jellyfin & Emby).
It guarantees that Smart Lounge remains the authoritative identity provider while preserving media streaming performance over local networks.

---

## 2. Key Architecture Decisions
- **Decision 11 (Hybrid Management)**: Supports both **Automated Provisioning** (triggered upon registration or login) and **Manual Linking** (attaching legacy or unlinked accounts).
- **Decision 18 (Identity Authority)**: Media servers manage media libraries and playback sessions; Smart Lounge owns authentication credentials, access policies, and subscriber lifecycle states.
- **Decision 30 (Multi-Tenancy)**: Account mappings, sync records, and server settings are tenant-scoped.
- **Decision 57 (Secrets Management)**: Passwords generated for external media server accounts are encrypted at rest using **Fernet symmetric encryption** (`external_password_encrypted`).

---

## 3. Data Models
1. **`MediaServer`**:
   - Configuration for auto-provisioning (`provisioning_enabled`, `provisioning_mode`, `auto_create_on_first_login`, `username_pattern`, `default_policy`, `default_library_ids`).
2. **`MediaAccountMapping`**:
   - Central bridge model storing `user_id`, `media_server_id`, `external_user_id`, `external_username`, encrypted credentials, `provisioning_status`, and `sync_status`.
3. **`MediaServerUserSync`**:
   - Audit trail for full, incremental, and reconciliation sync operations.
4. **`MediaServerOrphanUser`**:
   - Tracks detected unmapped accounts on media servers for admin resolution (Claim, Ignore, or Delete).

---

## 4. REST API Reference
### User Endpoints:
- `GET /api/v1/me/media-accounts/`: List user's mapped media accounts.
- `GET /api/v1/me/media-accounts/{id}/`: Single account detail.
- `POST /api/v1/me/media-accounts/{id}/reset-password/`: User password rotation (returns new password once).

### Admin Endpoints:
- `GET /api/v1/admin/media-account-mappings/`: Filterable grid of all account mappings.
- `POST /api/v1/admin/media-account-mappings/provision/`: Provision account for a user.
- `POST /api/v1/admin/media-account-mappings/{id}/{action}/`: Actions (`disable`, `enable`, `delete`, `apply-policy`, `reset-password`, `sync`).
- `POST /api/v1/admin/media-account-mappings/bulk/{op_type}/`: Bulk actions (`bulk-provision`, `bulk-disable`, `bulk-apply-policy`).
- `GET /api/v1/admin/media-account-mappings/dashboard/`: Health metrics, success rates, and live alerts.
- `GET /api/v1/admin/media-servers/{id}/orphan-users/`: List detected orphan accounts.
- `POST /api/v1/admin/media-servers/{id}/sync-users/`: Trigger on-demand sync.

---

## 5. Security & Idempotency
- **Idempotent Execution**: Repeated provisioning calls check for existing active mappings and server accounts before creating new ones.
- **Conflict Resolution**: `UsernameConflictResolver` handles collisions by testing numerical suffixes (`LU-00012-2`, `LU-00012-3`).
- **No Cascade Deletion**: Server accounts are never blindly deleted; orphaned accounts are isolated in `MediaServerOrphanUser` for admin review.
