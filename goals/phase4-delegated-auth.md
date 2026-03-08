# Phase 4: Delegated Auth + CallerObjectId + Persistent Cache

Add interactive login, per-user impersonation, and persistent schema caching.

## Status: Complete

## Prerequisites

- [x] Phase 3 complete (MCP surface working)

## Deliverables

### Delegated Auth (PKCE)

- [x] `dvx auth login [--name <profile>]` — browser-based PKCE flow
  - Open browser for authorization
  - Receive callback on localhost
  - Exchange code for tokens
  - Scope: `<environmentUrl>/user_impersonation`
- [x] Token caching in OS keychain
  - Refresh token stored securely
  - Access token refreshed automatically when expired
- [x] `dvx auth login` works as alternative to service principal for audit-trail scenarios

### CallerObjectId Impersonation

- [x] `--as-user <entra-object-id>` flag on all mutating operations
  - Requires service principal auth (Pattern 1)
  - Requires `prvActOnBehalfOfAnotherUser` privilege
  - Adds `CallerObjectId: <guid>` header to request
- [x] Validate entra object ID format before sending
- [x] Clear error when privilege is missing

### Persistent Schema Cache

- [x] Replace in-memory cache with SQLite-backed cache
  - TTL-managed entries
  - Survives across CLI invocations
  - Stored in `.dvx/cache.db`
- [x] `dvx schema --refresh` — force cache invalidation for a specific entity
- [x] `dvx schema --refresh-all` — clear entire cache
- [x] Cache still respects `--no-cache` flag
- [x] `DVX_SCHEMA_CACHE_TTL_MS` env var still works

### SKILL.md Files

- [x] `skills/dvx-field-service/SKILL.md` — work orders, scheduling, resource bookings
- [x] `skills/dvx-batch/SKILL.md` — batch operation patterns, changeset usage
- [x] `skills/dvx-auth/SKILL.md` — auth setup, service principal creation guide

### Tests

- [x] Delegated auth: PKCE flow mock, token refresh
- [x] CallerObjectId: header added correctly, error on missing privilege
- [x] Persistent cache: store, retrieve, TTL expiry, refresh, cross-process
- [x] Integration: delegated auth against sandbox (skipped in CI)

## Definition of Done

Both auth patterns working, CallerObjectId impersonation tested, schema cache
persists across sessions, remaining SKILL.md files shipped, CI green.
