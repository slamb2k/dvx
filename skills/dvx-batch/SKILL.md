# dvx-batch Skill

## When to Use Batch

- Bulk inserts or updates where individual HTTP round-trips are too slow
- Cross-reference operations where one record's ID feeds into another (Content-ID)
- Atomic changesets where all operations must succeed or all roll back
- Operations exceeding 1000 records (dvx auto-chunks)

## Operation JSON Format

Batch input is a JSON array of operation objects:

```json
[
  {
    "method": "POST",
    "path": "/accounts",
    "body": { "name": "Acme Corp" },
    "contentId": "1"
  },
  {
    "method": "POST",
    "path": "/contacts",
    "body": {
      "firstname": "Jane",
      "parentcustomerid_account@odata.bind": "$1"
    }
  }
]
```

Fields:
- `method` — GET, POST, PATCH, or DELETE
- `path` — relative OData path (no base URL)
- `body` — optional JSON body object
- `contentId` — optional string; referenced by later operations as `$<contentId>`
- `headers` — optional per-operation headers map

## --atomic Flag

Without `--atomic`: operations run as independent requests within a batch. Partial failure is possible.

With `--atomic`: operations are wrapped in a single OData changeset. If any operation fails, the entire changeset rolls back.

```
dvx batch --file ops.json --atomic
```

Changesets default to 100 operations. Adjust with `DVX_BATCH_CHANGESET_SIZE` (not yet implemented).

## Auto-chunking

Dataverse limits each `$batch` request to 1000 operations. dvx automatically splits larger arrays into chunks of 1000 and sends them sequentially, reporting progress per chunk.

## Content-ID Cross-referencing

When creating related records in one batch:
1. Assign `contentId` to the parent operation.
2. In child operations, reference it as `$<contentId>` in OData bind expressions.

This avoids a round-trip to retrieve the newly created parent ID.

## Error Handling

Batch responses are multipart. Each part has its own HTTP status. dvx parses the response and reports:
- `chunk` — which chunk of the total
- `totalChunks` — number of chunks sent
- `operations` — operations in this chunk
- `responseLength` — raw response byte length

For detailed per-operation error checking, inspect the raw response or use `--dry-run` to preview without executing.
