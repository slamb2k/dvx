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
- `@microsoft/microsoft-graph-client` (Graph API for app provisioning)
- `@clack/prompts` (interactive CLI prompts — select, text, spinner)
- `better-sqlite3` (SQLite schema cache)
- `commander` (CLI framework)
- `fast-xml-parser` (FetchXML parsing)
- `zod` (response validation)
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
- Contextual error hints via `getHint()` in `src/index.ts` — all CLI errors pass through this for agent/human-friendly guidance.

## Code Conventions

- kebab-case for files, PascalCase for classes, camelCase for functions and variables
- Named exports everywhere — no default exports except CLI entry point
- All errors as typed custom Error subclasses in `src/errors.ts`
- Async/await throughout — no callbacks, no `.then()` chains
- All Web API responses validated with `zod` before use
- `src/` structure: `auth/`, `client/`, `commands/`, `mcp/`, `schema/`, `utils/`
- `skills/` — domain-specific SKILL.md files for agent instruction:
  `dvx-auth/`, `dvx-batch/`, `dvx-dataverse-gotchas/`, `dvx-field-service/`,
  `dvx-sales/`, `dvx-schema/`, `dvx-service/`
- `deploy/` — Azure Container Apps IaC (Bicep) and environment matrix
- `docs/` — comparison docs, reference material
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

Phases 1–6 are **complete**. See `SPEC.md` for full details.

Phase 6 (`dvx init` → `dvx auth login` refactor) is merged. Auth commands now follow
Microsoft CLI conventions with auto-discovery and Graph API app provisioning.

## Operating Framework: GOTCHA

This project uses the **GOTCHA Framework** — a 6-layer architecture for
agentic AI systems. LLMs handle reasoning; deterministic tools handle execution.

**GOT** (The Engine):
- **Goals** (`goals/`) — Process definitions. Check `goals/manifest.md` first.
- **Orchestration** — You (the AI). Read goals, delegate to tools, handle errors.
- **Tools** (`tools/`) — Scripts. Check `tools/manifest.md` first.

**CHA** (The Context):
- **Context** (`context/`) — Domain knowledge, reference material
- **Hard Prompts** (`hardprompts/`) — Reusable instruction templates
- **Args** (`args/`) — Behaviour settings (YAML/JSON)

### Operating Rules

1. **Check goals first** — Before any task, read `goals/manifest.md`
2. **Check tools first** — Before writing code, read `tools/manifest.md`
3. **Fix and document** — When tools fail, fix them and update the goal
4. **Never modify goals without permission** — Goals are living documentation
5. **Communicate when stuck** — Explain what is missing, do not guess

## Build Methodology: BRACE

See `goals/build_app.md` for the full workflow:
- **B**rief — Define problem, users, success metrics
- **R**esearch — Data schema, integrations, stack proposal
- **A**rchitect — Design structure, validate all connections
- **C**onstruct — Build DB first, then API, then UI
- **E**valuate — Functional, integration, edge case, acceptance testing

## Question & Assumption Accountability

Nothing gets silently dropped. Every open question, assumption, and deferred
decision must be explicitly recorded and revisited.

- When you make an assumption, **state it explicitly** and record it
- When a question cannot be answered immediately, log it as an open item
- When you defer a fix or skip an edge case, document why and what triggers it
- At the end of each task, review all assumptions and open questions
- Present unresolved items to the user with context and suggested actions
- Unresolved items go to `goals/` as follow-ups, to CLAUDE.md as "Known Issues",
  or to memory for future session awareness
- At the start of new work, check for outstanding items from previous sessions
- Never close a task with unacknowledged open questions

## Guardrails

- Always check manifests before creating new goals or tools
- Verify tool output format before chaining into another tool
- Do not assume APIs support batch operations — check first
- Preserve intermediate outputs when workflows fail mid-execution
- Read the full goal before starting — do not skim
- Temporary files go in `.tmp/` — never store important data there
