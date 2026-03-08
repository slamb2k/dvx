# CLAUDE.md

## Project

dvx: Agent-first CLI and MCP server for Microsoft Dataverse CE/Sales/Service.

## Spec

Read `SPEC.md` for the full implementation specification. It is the source of truth.

## Tech Stack

- TypeScript, Node.js 18+, strict mode
- pnpm (package manager)
- `@modelcontextprotocol/sdk` (MCP stdio server)
- `@azure/msal-node` (auth — both client credentials and PKCE)
- `commander` (CLI framework)
- `tsup` (build)
- No ORM, no heavy framework — this is a CLI tool

## Architecture Rules

- One source of truth: `EntityDefinitions` API. Never hardcode entity schemas or field lists.
- Schema is always fetched live or from short-lived cache. TTL 5 min default.
- Raw JSON payload is the primary input path (`--json`). Convenience flags are secondary.
- All Dataverse operations go through a single `DataverseClient` class. No direct fetch calls in command handlers.
- MCP tool list is generated dynamically from EntityDefinitions. Never hand-authored.
- Meta-tools (`discover_entity`, `list_entities`, `execute_query`, `execute_action`, `batch_execute`) are always registered in MCP, regardless of `--entities` scope.
- `--dry-run` must be implemented on ALL mutating operations before those operations ship.
- Secrets (client secrets, tokens) are never written to config files. OS keychain or env vars only.

## Code Conventions

- kebab-case for files, PascalCase for classes, camelCase for functions and variables
- Named exports everywhere — no default exports except CLI entry point
- All errors as typed custom Error subclasses in `src/errors.ts`
- Async/await throughout — no callbacks, no `.then()` chains
- All Web API responses validated with `zod` before use
- `src/` structure: `auth/`, `client/`, `commands/`, `mcp/`, `schema/`, `skills/`, `utils/`
- Tests in `__tests__/` adjacent to source files

## Patterns to Follow

- **Field masking on all queries** — always apply `$select` or `--fields`, never return full records by default
- **NDJSON streaming** — page through results and emit one record per line rather than buffering arrays
- **Retry with backoff** — all Web API calls go through `withRetry()` which handles 429 + `Retry-After` header
- **Input validation before sending** — validate GUIDs, entity names, and FetchXML before any HTTP call
- **Schema cache pattern** — `SchemaCache.get(entityName)` checks TTL, fetches if stale, returns typed `EntitySchemaCacheEntry`

## Patterns to Avoid

- Do NOT load all entity schemas at startup — on-demand only
- Do NOT buffer full result sets in memory — stream NDJSON
- Do NOT write secrets to disk in plaintext
- Do NOT hardcode entity logical names, field names, or option set values anywhere in source
- Do NOT implement convenience abstractions that hide the underlying API shape from agents — fidelity over ergonomics
- Do NOT use `any` type — use `unknown` and narrow explicitly

## Testing

- Unit tests with `vitest`
- Mock `DataverseClient` for command handler tests
- Integration tests against a real sandbox environment, skipped in CI unless `DATAVERSE_TEST_URL` is set
- Every command must have at least one unit test covering happy path and error path

## Environment

Required env vars for development:
```
DATAVERSE_URL=https://yourorg.crm.dynamics.com
DATAVERSE_CLIENT_ID=<app registration client id>
DATAVERSE_CLIENT_SECRET=<stored in keychain, pass via env for CI>
DATAVERSE_TENANT_ID=<entra tenant id>
```

Optional:
```
DVX_SCHEMA_CACHE_TTL_MS=300000   # 5 min default
DVX_MAX_ROWS=5000
DVX_DEBUG=true                   # verbose HTTP logging
```

## Current Phase

Start with **Phase 1** from `SPEC.md`:
- `dvx auth create --service-principal`
- `dvx entities`
- `dvx schema <entity>`
- `dvx query --odata` (single page + `--page-all`)
- `dvx get <entity> <id>`

Do not implement mutations, FetchXML, batch, or MCP surface until Phase 1 commands are working and tested.
