# dvx Dataverse Gotchas

Common pitfalls and platform constraints when working with Dataverse via dvx.

## Plugin Opacity

Server-side plugins run synchronously in the same transaction as your API call.
They can silently override field values you set. If a PATCH returns 204 but the
field value is different when you GET the record back, a plugin ran.

There is no API to list registered plugins for a given entity/message. Check
the Plugin Trace Log in the Power Platform admin center when behaviour is unexpected.

## Restricted and System Tables

- `systemuser` — Cannot be created or deleted via API. Users are provisioned through
  Entra ID / licence assignment. You can update some fields (e.g. `businessunitid`).
- `businessunit` — Hierarchical. Root BU cannot be deleted. Moving users between BUs
  affects security role assignments.
- `role`, `roleprivileges` — Read-only via Web API for most operations.
- `organization` — Single-row system table. Most fields are read-only.
- `solution`, `solutioncomponent` — Managed solutions cannot be modified; only unmanaged
  layers can be edited. Always work in an unmanaged solution layer in dev.

## Virtual Tables

Virtual tables surface external data through a provider plugin. They behave like
standard entities in reads but do not support direct writes (create/update/delete
go to the external system via the provider, if the provider implements it).
`dvx create` / `dvx update` will return a 400 or 501 for virtual tables without a
write provider.

## Calculated and Rollup Fields

- **Calculated fields** — Computed server-side. Any value you write to them is silently
  discarded. They appear writable in schema but are not.
- **Rollup fields** — Asynchronously updated by a system job. Values may be hours stale.
  Trigger recalculation with the `CalculateRollupField` action.

## Status / StatusReason Relationships

`statecode` and `statuscode` are paired. Each `statecode` value has a fixed set of
valid `statuscode` values. Setting an incompatible combination returns a 400.

To transition state, always set both fields together or use the entity-specific
action (e.g. `WinOpportunity`, `CloseIncident`, `SetState`).

## Connection References and Environment Variables

When deploying solutions across environments:
- Connection references hold the connector + connection identity. They must be
  configured per environment post-import.
- Environment variables store config values. Retrieve current value with:
  ```
  dvx query --odata "environmentvariablevalues?$select=value&$filter=environmentvariabledefinitionid/schemaname eq '<schemaname>'"
  ```
  Update via PATCH on `environmentvariablevalue` (create if no value record exists yet).

## Throttling (Service Protection Limits)

Microsoft enforces three per-user-per-org limits over a rolling 5-minute window:
- 6,000 requests
- 20 minutes of combined execution time
- 52 concurrent requests

When exceeded, the API returns **HTTP 429** with a `Retry-After` header (seconds).
dvx automatically retries with the `Retry-After` delay via `withRetry()`.

For bulk operations, prefer:
1. `dvx batch` — groups operations into multipart batch requests (up to 1,000 per batch)
2. `dvx query --page-all` — streams pages sequentially, respecting backpressure

## OData Quirks

- `$filter` string values use single quotes: `name eq 'Acme Corp'`
- Enum/OptionSet filters use integer values: `statecode eq 0`
- GUIDs in filters do NOT use quotes: `accountid eq 00000000-0000-0000-0000-000000000001`
- Navigation properties for lookups use `_<field>_value` for raw GUID:
  `$filter=_parentaccountid_value eq <guid>`
- `@odata.bind` syntax is required when setting lookup fields in POST/PATCH body

## Deletion Constraints

- Records with active child records (e.g. open cases on an account) may be blocked
  unless cascade delete is configured on the relationship.
- Some entities enforce business rules that prevent deletion (e.g. active contracts).
- Use `--dry-run` to preview before destructive operations.
