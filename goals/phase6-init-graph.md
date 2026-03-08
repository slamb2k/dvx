# Phase 6: dvx init — Interactive Entra App Registration

Implement the Graph API automation path in `dvx init` so users can create
an Entra app registration and service principal interactively, without
manual Azure portal steps.

## Status: Not Started

## Prerequisites

- [ ] Resolve the bootstrapper identity problem (see Known Issues below)
- [ ] Phase 5 complete

## Known Issues

### Bootstrapper Identity Problem

To acquire a Graph API token via PKCE (delegated auth), `dvx init` needs a
pre-existing `clientId` for a `PublicClientApplication`. This is a
chicken-and-egg problem: the service principal being created doesn't exist
yet, so it can't be used for the token acquisition.

Two resolution paths:

1. **dvx bootstrapper app** — Register a dedicated multi-tenant Entra app
   owned by the dvx project. Users consent `Application.ReadWrite.All` once
   during `dvx init`. This matches how Azure CLI works (`az` has its own
   well-known client ID). Requires owning an Entra tenant and admin consent
   for the Graph permission.

2. **User-supplied bootstrapper** — Add `--bootstrapper-client-id <id>` flag.
   The user pre-registers a minimal single-tenant app in their own tenant
   with `Application.ReadWrite.All` delegated. `dvx init` uses it once to
   bootstrap the Dataverse service principal, then it can be deleted.
   Less magic but more setup friction.

**Recommended:** Option 2 (user-supplied) until the dvx project has its own
tenant and can ship a first-party bootstrapper app ID.

## Deliverables

### Graph API Provisioning

- [ ] `dvx init --bootstrapper-client-id <id>` — PKCE flow for Graph access
  - Scope: `https://graph.microsoft.com/Application.ReadWrite.All`
  - Use `PublicClientApplication.acquireTokenInteractive` (reuse pattern
    from `AuthManager.getTokenDelegated`)
  - `POST /applications` — create app registration
  - `POST /applications/{id}/addPassword` — add client secret
  - `POST /servicePrincipals` — create service principal
  - On failure: fall through to manual instructions (existing path)
- [ ] Remove stale `vi.mock('isomorphic-fetch', ...)` from init.test.ts
  - `isomorphic-fetch` is not a runtime dependency; Graph client v3 uses
    native `fetch` in Node 18+
- [ ] Update init.test.ts Graph mock to use `@microsoft/microsoft-graph-client` v3 API
  - The existing mock targets `Client.init().api().post()` which is v2 style
  - v3 uses `Client.initWithMiddleware` + `client.api().post()`

### Tests

- [ ] Graph path: happy path (mock POST /applications + POST /addPassword)
- [ ] Graph path: fallback on 403 Forbidden (missing admin consent)
- [ ] Graph path: fallback on network error
- [ ] Manual path: unchanged behaviour

## Definition of Done

`dvx init --bootstrapper-client-id <id>` creates a service principal and
auth profile end-to-end; falls back gracefully to manual instructions on
any Graph API failure; tests cover both paths.
