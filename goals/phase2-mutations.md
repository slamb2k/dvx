# Phase 2: Mutations + FetchXML + Batch

Add write operations, FetchXML queries, and batch support. All mutating
operations require `--dry-run` before shipping.

## Status: Not Started

## Prerequisites

- [ ] Phase 1 complete and validated against a real environment

## Deliverables

### CRUD Operations

- [ ] `dvx create <entity> --json '<payload>'`
  - POST to `/<entitySetName>`
  - Return created record ID
  - `--dry-run`: validate payload shape, print request, do not send
- [ ] `dvx update <entity> <id> --json '<payload>'`
  - PATCH to `/<entitySetName>(<id>)`
  - `--dry-run` support
- [ ] `dvx upsert <entity> --match-field <field> --json '<payload>'`
  - GET by match field, then CREATE or UPDATE
  - `--dry-run` support
- [ ] `dvx delete <entity> <id>`
  - DELETE to `/<entitySetName>(<id>)`
  - `--confirm` required in interactive mode
  - `--dry-run` support

### FetchXML

- [ ] `dvx query --fetchxml '<xml>'`
  - URL-encode and pass as `?fetchXml=<encoded>`
  - Validate XML structure before sending (prevent injection)
- [ ] FetchXML paging cookie handling
  - Extract `@Microsoft.Dynamics.CRM.fetchxmlpagingcookie`
  - Re-encode between pages
- [ ] `dvx query --file <path>`
  - Read query from file
  - Auto-detect OData vs FetchXML based on content

### Batch Operations

- [ ] `dvx batch --file <path>`
  - Parse operations JSON file
  - POST to `/$batch` with multipart/mixed
  - Handle content IDs for cross-referencing
- [ ] `--atomic` flag
  - Wrap operations in changeset for transactional semantics
- [ ] Auto-chunking
  - Respect 1000 operations per batch limit
  - Default 100 operations per changeset
  - Progress output during chunked execution

### Infrastructure

- [ ] `--dry-run` flag on DataverseClient mutating methods
  - Validate request locally
  - Print method, URL, headers, body
  - Return without executing
- [ ] `--confirm` prompt for delete operations
  - Skip in non-interactive mode (pipe detection)
- [ ] Input validation
  - GUID format validation (already done)
  - Entity name sanitisation (already done)
  - FetchXML structure validation (new)
  - JSON payload validation against schema (optional, warn-only)

### Tests

- [ ] Create command: happy path + validation error + API error
- [ ] Update command: happy path + record not found + validation error
- [ ] Upsert command: create path + update path
- [ ] Delete command: happy path + not found + confirm prompt
- [ ] FetchXML query: single page + paging cookie + invalid XML
- [ ] Batch: single batch + chunked + atomic changeset
- [ ] Dry-run: verify no HTTP calls made, output correct

## Data Models

```typescript
// Already defined in SPEC.md
interface BatchOperation {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  headers?: Record<string, string>
  body?: unknown
  contentId?: string
}

interface BatchRequest {
  operations: BatchOperation[]
  atomic: boolean
}
```

## Definition of Done

All CRUD commands working with `--dry-run`, FetchXML with paging,
batch with `--atomic`, full test coverage, CI green.
