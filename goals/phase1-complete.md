# Phase 1: Complete Auth + Schema Discovery + Basic Query

Close out Phase 1 by validating against a real environment, adding missing
commands, and reaching test coverage targets.

## Status: In Progress

## Completed

- [x] `dvx auth create --service-principal` — stores profile, validates connection
- [x] `dvx entities` — returns entity name list from EntityDefinitions
- [x] `dvx schema <entity>` — returns field-masked entity schema as JSON
- [x] `dvx query --odata '<expr>'` — OData passthrough, single page
- [x] `dvx query --odata '<expr>' --page-all` — full paging, NDJSON output
- [x] `dvx get <entity> <id>` — single record fetch
- [x] Output formats: JSON and table
- [x] Local schema cache (in-memory, session-scoped)
- [x] Input validation (GUID, entity name, URL)
- [x] Retry with exponential backoff on 429/5xx
- [x] Typed error hierarchy in `src/errors.ts`
- [x] Validation tests (12) + schema cache tests (5)

## Remaining

### Missing Commands

- [x] `dvx auth list` — list all saved auth profiles
- [x] `dvx auth select <profile>` — switch active profile

### End-to-End Validation

- [ ] Connect to a real Dataverse sandbox environment
- [ ] Validate auth token acquisition (service principal)
- [ ] Validate `dvx entities` returns entity list
- [ ] Validate `dvx schema account` returns attribute definitions
- [ ] Validate `dvx query --odata 'accounts?$top=5'` returns records
- [ ] Validate `dvx get account <real-guid>` returns a record
- [ ] Validate `--page-all` streams NDJSON across multiple pages

### Test Coverage

- [x] Command handler tests: `auth-create` (happy + error)
- [x] Command handler tests: `entities` (happy + error)
- [x] Command handler tests: `schema` (happy + error)
- [x] Command handler tests: `query` (happy + error)
- [x] Command handler tests: `get` (happy + error)
- [x] DataverseClient unit tests with mocked fetch
- [x] Retry logic tests (429 handling, backoff)

### Polish

- [x] Table output for `dvx entities` — handle empty results gracefully
- [x] Error messages: user-friendly for common failures (no profile, bad credentials, 401, 403)
- [x] `--output json` flag consistency across all commands
- [ ] `DVX_DEBUG=true` logging verified working

## Dependencies

- Entra ID app registration with client ID + secret
- Application user created in target Dataverse org
- Security role assigned to application user

## Definition of Done

All commands working against a real org, all command handlers have unit tests
with mocked DataverseClient, CI green.
