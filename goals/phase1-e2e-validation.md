# Phase 1: E2E Validation (Deferred)

Validate Phase 1 commands against a real Dataverse sandbox environment.

## Status: Blocked — Awaiting Sandbox Access

## Prerequisites

- Entra ID app registration with client ID + secret
- Application user created in target Dataverse org
- Security role assigned to application user
- Environment variables set: DATAVERSE_URL, DATAVERSE_CLIENT_ID, DATAVERSE_CLIENT_SECRET, DATAVERSE_TENANT_ID

## Validation Items

- [ ] Connect to a real Dataverse sandbox environment
- [ ] Validate auth token acquisition (service principal)
- [ ] Validate `dvx entities` returns entity list
- [ ] Validate `dvx schema account` returns attribute definitions
- [ ] Validate `dvx query --odata 'accounts?$top=5'` returns records
- [ ] Validate `dvx get account <real-guid>` returns a record
- [ ] Validate `--page-all` streams NDJSON across multiple pages

## Definition of Done

All 7 items verified against a live org. Update goals/phase1-complete.md status to Complete when done.
