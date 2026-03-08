# Phase 4: Delegated Auth + CallerObjectId + Persistent Cache

Add interactive login, per-user impersonation, and persistent schema caching.

## Status: Not Started

## Prerequisites

- [ ] Phase 3 complete (MCP surface working)

## Deliverables

### Delegated Auth (PKCE)

- [ ] `dvx auth login [--name <profile>]` — browser-based PKCE flow
  - Open browser for authorization
  - Receive callback on localhost
  - Exchange code for tokens
  - Scope: `<environmentUrl>/user_impersonation`
- [ ] Token caching in OS keychain
  - Refresh token stored securely
  - Access token refreshed automatically when expired
- [ ] `dvx auth login` works as alternative to service principal for audit-trail scenarios

### CallerObjectId Impersonation

- [ ] `--as-user <entra-object-id>` flag on all mutating operations
  - Requires service principal auth (Pattern 1)
  - Requires `prvActOnBehalfOfAnotherUser` privilege
  - Adds `CallerObjectId: <guid>` header to request
- [ ] Validate entra object ID format before sending
- [ ] Clear error when privilege is missing

### Persistent Schema Cache

- [ ] Replace in-memory cache with SQLite-backed cache
  - TTL-managed entries
  - Survives across CLI invocations
  - Stored in `.dvx/cache.db`
- [ ] `dvx schema --refresh` — force cache invalidation for a specific entity
- [ ] `dvx schema --refresh-all` — clear entire cache
- [ ] Cache still respects `--no-cache` flag
- [ ] `DVX_SCHEMA_CACHE_TTL_MS` env var still works

### SKILL.md Files

- [ ] `skills/dvx-field-service/SKILL.md` — work orders, scheduling, resource bookings
- [ ] `skills/dvx-batch/SKILL.md` — batch operation patterns, changeset usage
- [ ] `skills/dvx-auth/SKILL.md` — auth setup, service principal creation guide

### Tests

- [ ] Delegated auth: PKCE flow mock, token refresh
- [ ] CallerObjectId: header added correctly, error on missing privilege
- [ ] Persistent cache: store, retrieve, TTL expiry, refresh, cross-process
- [ ] Integration: delegated auth against sandbox (skipped in CI)

## Definition of Done

Both auth patterns working, CallerObjectId impersonation tested, schema cache
persists across sessions, remaining SKILL.md files shipped, CI green.
