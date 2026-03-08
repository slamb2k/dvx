# Phase 3: Actions + MCP Surface

Add custom action execution and the MCP stdio server with dynamic tool
generation from EntityDefinitions.

## Status: Not Started

## Prerequisites

- [ ] Phase 2 complete (CRUD, FetchXML, batch all working)

## Deliverables

### Action Executor

- [ ] `dvx action <ActionName> --json '<payload>'` — unbound action
  - POST to `/api/data/v9.2/<ActionName>`
- [ ] `dvx action <ActionName> --entity <entity> --id <guid> --json '<payload>'` — bound action
  - POST to `/api/data/v9.2/<entitySetName>(<id>)/Microsoft.Dynamics.CRM.<ActionName>`
- [ ] Handle standard CRM SDK messages (WinOpportunity, Merge, RouteCaseToQueue, etc.)
- [ ] `--dry-run` support on all action calls
- [ ] Validate action name and payload before sending

### MCP Stdio Server

- [ ] `dvx mcp` — starts MCP stdio server using `@modelcontextprotocol/sdk`
- [ ] `--entities <comma-separated>` — scope tool list to specific entities
- [ ] `--port <n>` — optional (future HTTP/SSE, Phase 5)

### Meta-Tools (always registered)

- [ ] `discover_entity(entity_name)` — fetch entity schema on demand
- [ ] `list_entities()` — entity names only
- [ ] `execute_query(odata|fetchxml)` — raw query passthrough
- [ ] `execute_action(name, payload, entity?, id?)` — action executor
- [ ] `batch_execute(operations[])` — batch wrapper

### Dynamic Entity Tools

- [ ] Tool list generated from EntityDefinitions for scoped entities
- [ ] `create_<entity>` — inputSchema derived from AttributeDefinitions
- [ ] `update_<entity>` — inputSchema with ID + partial attributes
- [ ] `get_<entity>` — inputSchema with ID + optional fields
- [ ] `query_<entity>` — inputSchema with OData filter + fields
- [ ] Tool descriptions concise (<100 chars per spec)

### SKILL.md Files

- [ ] `skills/dvx-sales/SKILL.md` — opportunity lifecycle, stage transitions, quota
- [ ] `skills/dvx-service/SKILL.md` — case management, SLA fields, queue routing
- [ ] `skills/dvx-schema/SKILL.md` — schema discovery patterns, FetchXML examples
- [ ] `skills/dvx-dataverse-gotchas/SKILL.md` — plugin opacity, restricted tables, virtual tables

### Tests

- [ ] Action executor: unbound happy path + bound happy path + invalid action
- [ ] MCP server: startup, tool listing, meta-tool invocation
- [ ] Dynamic tool generation: correct inputSchema from schema
- [ ] Entity scoping: `--entities` limits tool list correctly
- [ ] Meta-tools available regardless of `--entities` scope

## Definition of Done

MCP server starts, registers dynamic tools for scoped entities, meta-tools
work for any entity, actions execute correctly, SKILL.md files for core
domains shipped, CI green.
