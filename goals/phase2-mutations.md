# Phase 2: Mutations + FetchXML + Batch

Add write operations, FetchXML queries, and batch support. All mutating
operations require `--dry-run` before shipping.

## Status: Complete

## Prerequisites

- [x] Phase 1 complete and validated against a real environment

## Deliverables

### CRUD Operations

- [x] `dvx create <entity> --json '<payload>'`
  - POST to `/<entitySetName>`
  - Return created record ID
  - `--dry-run`: validate payload shape, print request, do not send
- [x] `dvx update <entity> <id> --json '<payload>'`
  - PATCH to `/<entitySetName>(<id>)`
  - `--dry-run` support
- [x] `dvx upsert <entity> --match-field <field> --json '<payload>'`
  - GET by match field, then CREATE or UPDATE
  - `--dry-run` support
- [x] `dvx delete <entity> <id>`
  - DELETE to `/<entitySetName>(<id>)`
  - `--confirm` required in interactive mode
  - `--dry-run` support

### FetchXML

- [x] `dvx query --fetchxml '<xml>'`
  - URL-encode and pass as `?fetchXml=<encoded>`
  - Validate XML structure before sending (prevent injection)
- [x] FetchXML paging cookie handling
  - Extract `@Microsoft.Dynamics.CRM.fetchxmlpagingcookie`
  - Re-encode between pages
- [x] `dvx query --file <path>`
  - Read query from file
  - Auto-detect OData vs FetchXML based on content

### Batch Operations

- [x] `dvx batch --file <path>`
  - Parse operations JSON file
  - POST to `/$batch` with multipart/mixed
  - Handle content IDs for cross-referencing
- [x] `--atomic` flag
  - Wrap operations in changeset for transactional semantics
- [x] Auto-chunking
  - Respect 1000 operations per batch limit
  - Default 100 operations per changeset
  - Progress output during chunked execution

### Infrastructure

- [x] `--dry-run` flag on DataverseClient mutating methods
  - Validate request locally
  - Print method, URL, headers, body
  - Return without executing
- [x] `--confirm` prompt for delete operations
  - Skip in non-interactive mode (pipe detection)
- [x] Input validation
  - GUID format validation (already done)
  - Entity name sanitisation (already done)
  - FetchXML structure validation (new)
  - JSON payload validation against schema (optional, warn-only)

### Tests

- [x] Create command: happy path + validation error + API error
- [x] Update command: happy path + record not found + validation error
- [x] Upsert command: create path + update path
- [x] Delete command: happy path + not found + confirm prompt
- [x] FetchXML query: single page + paging cookie + invalid XML
- [x] Batch: single batch + chunked + atomic changeset
- [x] Dry-run: verify no HTTP calls made, output correct

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
