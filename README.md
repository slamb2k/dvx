# dvx

Agent-first CLI and MCP server for Microsoft Dataverse (CE / Sales / Service).

dvx treats the Dataverse Web API the way [gws](https://github.com/nicholasgasior/gws) treats Google Workspace — a single binary with a dual surface (CLI + MCP stdio) that derives its capabilities at runtime from the API's own schema. No hand-authored tool lists, no hardcoded entity definitions, no 20-row ceilings.

## Why dvx?

Dataverse is a uniquely hostile API for AI agents:

- **Opaque GUIDs everywhere** — every entity, relationship, and option set is a UUID with no human-readable context
- **Enormous, per-org $metadata** — the OData metadata document can exceed 50MB, and every org's schema is different
- **Polymorphic lookups** — a single lookup field can reference multiple entity types
- **Invisible business logic** — server-side plugins, workflows, and business rules execute silently on write operations
- **Complex batch format** — OData `$batch` uses multipart MIME boundaries with changeset semantics

Microsoft's [official Dataverse MCP Server](https://github.com/microsoft/PowerApps-Tooling/tree/main/src/Mcp) takes a static approach: it pre-registers tools and caps query results at 20 rows with no pagination. dvx takes the opposite approach — it discovers the schema at runtime and streams results without artificial limits.

> **For a detailed comparison with use cases across 9 domains, see [docs/comparison-vs-official-mcp.md](docs/comparison-vs-official-mcp.md).**

## Install

```bash
# npm (all platforms)
npm install -g dvx

# Linux binary (x64)
curl -fsSL https://raw.githubusercontent.com/slamb2k/dvx/main/scripts/install.sh | sh
```

macOS users: install via npm. Pre-built macOS binaries are not currently published.

## Quick Start

### 1. Create an auth profile

```bash
# Service principal (non-interactive, CI/CD)
dvx auth create \
  --name myorg \
  --environment-url https://myorg.crm.dynamics.com \
  --tenant-id <tenant-id> \
  --client-id <client-id> \
  --client-secret <secret>

# Delegated (interactive browser login)
dvx auth login \
  --name myorg \
  --environment-url https://myorg.crm.dynamics.com \
  --tenant-id <tenant-id> \
  --client-id <client-id>
```

### 2. Query data

```bash
# List all entities
dvx entities

# Show schema for an entity
dvx schema account

# OData query
dvx query --odata '/accounts?$select=name,revenue&$top=10'

# FetchXML query
dvx query --fetchxml '<fetch top="10"><entity name="account"><attribute name="name"/></entity></fetch>'

# From file (auto-detects OData vs FetchXML)
dvx query --file my-query.xml --output ndjson
```

### 3. Mutate records

```bash
# Create
dvx create account --json '{"name": "Contoso Ltd", "revenue": 1000000}'

# Update
dvx update account 00000000-0000-0000-0000-000000000001 \
  --json '{"revenue": 2000000}'

# Upsert (match on a field)
dvx upsert account --match-field name \
  --json '{"name": "Contoso Ltd", "revenue": 2000000}'

# Delete
dvx delete account 00000000-0000-0000-0000-000000000001 --confirm

# All mutations support --dry-run
dvx create account --json '{"name": "Test"}' --dry-run
```

### 4. Batch operations

```bash
# From a JSON file of operations
dvx batch --file operations.json

# Atomic (wrapped in OData changeset)
dvx batch --file operations.json --atomic
```

Batch input format:
```json
[
  { "method": "POST", "path": "/accounts", "body": { "name": "Acme" } },
  { "method": "PATCH", "path": "/accounts(00000000-...)", "body": { "revenue": 500000 } }
]
```

### 5. Execute custom actions

```bash
# Global action
dvx action WinOpportunity --json '{"Status": 3, "OpportunityClose": {...}}'

# Bound action
dvx action QualifyLead --entity lead --id 00000000-... --json '{...}'
```

### 6. Interactive demo

`dvx demo` walks through dvx's differentiators with live Dataverse calls, comparison callouts, and auto-cleanup.

```bash
# Interactive tier selection (prompts if TTY)
dvx demo

# Non-interactive — specify tier directly
dvx demo --tier read    # Schema discovery, OData, FetchXML — no data changes
dvx demo --tier write   # Read + CRUD lifecycle with [dvx-demo] prefix, auto-cleanup
dvx demo --tier full    # Write + batch, WhoAmI action, impersonation, aggregation
```

Each step prints a comparison callout showing what native Dataverse MCP and PAC CLI cannot do. A summary table with pass/skip/fail status and elapsed times is printed at the end.

## MCP Server

dvx exposes a [Model Context Protocol](https://modelcontextprotocol.io) server for AI agent integration.

```bash
# stdio transport (default — for Claude Desktop, Cursor, etc.)
dvx mcp --entities account,contact,opportunity

# HTTP transport (for remote/multi-session deployments)
dvx mcp --transport http --port 3000 --entities account,contact
```

### Meta-tools (always available)

| Tool | Description |
|------|-------------|
| `list_entities` | List all entity logical names in the org |
| `discover_entity` | Fetch full schema for an entity (attributes, types, relationships) |
| `execute_query` | Run OData or FetchXML queries with full pagination |
| `execute_action` | Execute any global or bound Dataverse action |
| `batch_execute` | Run multiple operations in a single request, optionally atomic |

Meta-tools solve the **MCP dictionary problem** — instead of registering hundreds of tools upfront (one per entity), agents discover entities on-demand and use generic query/mutation tools. This keeps the tool list small and the agent's context window clean.

### Dynamic entity tools (per `--entities` scope)

When you pass `--entities account,contact`, dvx generates 4 typed tools per entity:

- `create_account` / `create_contact`
- `update_account` / `update_contact`
- `get_account` / `get_contact`
- `query_account` / `query_contact`

These provide typed input schemas derived from the entity's actual attributes — an agent can see exactly which fields exist, their types, and which are required.

### Claude Desktop configuration

```json
{
  "mcpServers": {
    "dataverse": {
      "command": "dvx",
      "args": ["mcp", "--entities", "account,contact,opportunity,lead"]
    }
  }
}
```

## Authentication

dvx supports three authentication patterns:

| Pattern | Use Case | Flow |
|---------|----------|------|
| **Service Principal** | CI/CD, server-to-server, MCP server | Client credentials (`ConfidentialClientApplication`) |
| **Delegated (PKCE)** | Interactive CLI use, per-user context | Browser-based OAuth with PKCE (`PublicClientApplication`) |
| **Impersonation** | Service principal acting as a specific user | `--as-user <EntraObjectId>` adds `CallerObjectId` header |

Secrets are **never written to disk**. Service principal client secrets are passed via environment variables. Delegated tokens are cached in `.dvx/msal-cache.json` (mode `0600`).

```bash
# Manage profiles
dvx auth list
dvx auth select myorg

# Impersonate a user (requires prvActOnBehalfOfAnotherUser privilege)
dvx create account --json '{"name": "Test"}' --as-user 00000000-...
```

## Key Features

- **Runtime schema discovery** — entity definitions fetched from `EntityDefinitions` API, never hardcoded
- **SQLite schema cache** — persistent cache with configurable TTL (default 5 min), survives restarts
- **FetchXML with auto-pagination** — paging cookies handled transparently
- **NDJSON streaming** — page through results emitting one record per line, no memory buffering
- **Retry with backoff** — automatic retry on 429/5xx with `Retry-After` header support
- **Dry-run on all mutations** — `--dry-run` prints what would execute without sending
- **Field masking** — `--fields` or `$select` on all queries, never returns full records by default
- **Batch operations** — up to 1000 ops per request with optional atomic changesets
- **Input validation** — GUIDs, entity names, action names, and URLs validated before any HTTP call
- **Typed errors** — full error hierarchy (`DvxError` → `AuthError`, `DataverseError`, `ValidationError`, etc.)

## Configuration

### Environment variables

```bash
# Required
DATAVERSE_URL=https://yourorg.crm.dynamics.com
DATAVERSE_CLIENT_ID=<app-registration-client-id>
DATAVERSE_CLIENT_SECRET=<from-keychain-or-env>
DATAVERSE_TENANT_ID=<entra-tenant-id>

# Optional
DVX_SCHEMA_CACHE_TTL_MS=300000    # Schema cache TTL (default: 5 min)
DVX_SCHEMA_CACHE_PATH=.dvx/cache.db  # SQLite cache location
DVX_MAX_ROWS=5000                 # Per-query row cap
DVX_DEBUG=true                    # Verbose HTTP logging
```

### Local files (managed by dvx)

| File | Purpose |
|------|---------|
| `.dvx/config.json` | Auth profiles (no secrets) |
| `.dvx/msal-cache.json` | MSAL delegated token cache (0600) |
| `.dvx/cache.db` | SQLite schema cache |

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  CLI (human) │     │  MCP (agent) │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                │
       ┌────────▼────────┐
       │  DataverseClient │   ← single client, all operations
       ├─────────────────┤
       │  AuthManager     │   ← service principal or PKCE
       │  SchemaCache     │   ← SQLite-backed, TTL-based
       │  withRetry()     │   ← 429/5xx backoff
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │  Dataverse       │
       │  Web API         │
       └─────────────────┘
```

All operations flow through a single `DataverseClient` class. No direct HTTP calls in command handlers or MCP tools. Schema is always fetched live or from cache — never hardcoded.

## Comparison with Microsoft's Official Dataverse MCP Server

See **[docs/comparison-vs-official-mcp.md](docs/comparison-vs-official-mcp.md)** for a detailed feature comparison and use cases across Sales, Customer Service, Field Service, Marketing, Finance, ALM, Data Migration, Security, and Reporting.

Key differences at a glance:

| Capability | dvx | Official Dataverse MCP |
|-----------|-----|----------------------|
| Query row limit | 5,000 (configurable) | **20 rows, hard-coded** |
| Pagination | Full (OData + FetchXML) | None |
| FetchXML | Full with auto-paging | Not supported |
| Batch operations | $batch with changesets | Not supported |
| Custom actions | `execute_action` | Not supported |
| Impersonation | `CallerObjectId` header | Not supported |
| Schema discovery | Runtime via EntityDefinitions | Static tool list |
| Dry-run | All mutations | Not supported |
| NDJSON streaming | Yes | No |
| CLI interface | Full featured | MCP only |

## License

MIT
