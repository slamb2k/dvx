# Phase 3: Actions + MCP Surface

Add custom action execution and the MCP stdio server with dynamic tool
generation from EntityDefinitions.

## Status: Complete

## Prerequisites

- [x] Phase 2 complete (CRUD, FetchXML, batch all working)

## Deliverables

### Action Executor

- [x] `dvx action <ActionName> --json '<payload>'` — unbound action
  - POST to `/api/data/v9.2/<ActionName>`
- [x] `dvx action <ActionName> --entity <entity> --id <guid> --json '<payload>'` — bound action
  - POST to `/api/data/v9.2/<entitySetName>(<id>)/Microsoft.Dynamics.CRM.<ActionName>`
- [x] Handle standard CRM SDK messages (WinOpportunity, Merge, RouteCaseToQueue, etc.)
- [x] `--dry-run` support on all action calls
- [x] Validate action name and payload before sending

### MCP Stdio Server

- [x] `dvx mcp` — starts MCP stdio server using `@modelcontextprotocol/sdk`
- [x] `--entities <comma-separated>` — scope tool list to specific entities
- [x] `--port <n>` — optional (future HTTP/SSE, Phase 5)

### Meta-Tools (always registered)

- [x] `discover_entity(entity_name)` — fetch entity schema on demand
- [x] `list_entities()` — entity names only
- [x] `execute_query(odata|fetchxml)` — raw query passthrough
- [x] `execute_action(name, payload, entity?, id?)` — action executor
- [x] `batch_execute(operations[])` — batch wrapper

### Dynamic Entity Tools

- [x] Tool list generated from EntityDefinitions for scoped entities
- [x] `create_<entity>` — inputSchema derived from AttributeDefinitions
- [x] `update_<entity>` — inputSchema with ID + partial attributes
- [x] `get_<entity>` — inputSchema with ID + optional fields
- [x] `query_<entity>` — inputSchema with OData filter + fields
- [x] Tool descriptions concise (<100 chars per spec)

### SKILL.md Files

- [x] `skills/dvx-sales/SKILL.md` — opportunity lifecycle, stage transitions, quota
- [x] `skills/dvx-service/SKILL.md` — case management, SLA fields, queue routing
- [x] `skills/dvx-schema/SKILL.md` — schema discovery patterns, FetchXML examples
- [x] `skills/dvx-dataverse-gotchas/SKILL.md` — plugin opacity, restricted tables, virtual tables

### Tests

- [x] Action executor: unbound happy path + bound happy path + invalid action
- [x] MCP server: startup, tool listing, meta-tool invocation
- [x] Dynamic tool generation: correct inputSchema from schema
- [x] Entity scoping: `--entities` limits tool list correctly
- [x] Meta-tools available regardless of `--entities` scope

## Definition of Done

MCP server starts, registers dynamic tools for scoped entities, meta-tools
work for any entity, actions execute correctly, SKILL.md files for core
domains shipped, CI green.
