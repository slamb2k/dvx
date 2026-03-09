# dvx vs Microsoft's Official Dataverse MCP Server

A detailed comparison of [dvx](https://github.com/slamb2k/dvx) and Microsoft's [official Dataverse MCP Server](https://github.com/microsoft/PowerApps-Tooling/tree/main/src/Mcp), with real-world use cases across 9 Dynamics 365 domains.

## The MCP Abstraction Tax

Every MCP server introduces an abstraction layer between the agent and the underlying API:

```
Agent → MCP Tool → REST API → Data
```

Each layer can lose fidelity. The question is: **how much of the underlying API's power does the MCP layer expose?**

Microsoft's official server takes a minimal approach — a handful of static tools with hard limits. dvx takes the opposite approach — runtime schema discovery and full API surface exposure, following the principle that **agents should have the same capabilities a human developer would have with the raw API**.

## Feature Comparison

| Capability | dvx | Official Dataverse MCP |
|-----------|-----|----------------------|
| **Query results** | Up to 5,000 rows (configurable via `DVX_MAX_ROWS`) | **20 rows, hard-coded, no pagination** |
| **OData queries** | Full `$filter`, `$select`, `$expand`, `$orderby`, `$top` | Basic `$filter` and `$select` only |
| **FetchXML** | Full support with auto-pagination via paging cookies | Not supported |
| **Batch operations** | OData `$batch` with changeset support, 1000 ops/request | Not supported |
| **Custom actions** | Any global or bound action via `execute_action` | Not supported |
| **Impersonation** | `CallerObjectId` header via `--as-user` | Not supported |
| **Schema discovery** | Runtime from `EntityDefinitions` API | Static, pre-registered tool list |
| **Tool registration** | Meta-tools + dynamic per-entity tools | All tools loaded upfront (dictionary problem) |
| **Dry-run** | All mutating operations | Not supported |
| **NDJSON streaming** | Record-by-record output, no memory buffering | JSON array in memory |
| **Field masking** | Automatic `$select` on all queries | Manual |
| **Auth patterns** | Service principal, delegated PKCE, impersonation | Service principal only |
| **CLI interface** | Full-featured command-line tool | MCP server only |
| **Retry / backoff** | Automatic on 429/5xx with `Retry-After` | Not implemented |
| **Schema cache** | SQLite-backed with configurable TTL | None |
| **Output formats** | JSON, NDJSON, table | JSON only |

### The 20-Row Problem

The official Dataverse MCP Server's `read_query` tool returns a maximum of 20 rows per call with no pagination token or continuation mechanism. This is confirmed in the source code and has not been addressed as of February 2026. For any real-world Dataverse work — reporting, data migration, bulk operations — this is a non-starter.

dvx defaults to 5,000 rows with full pagination (OData `@odata.nextLink` and FetchXML paging cookies). The limit is configurable via `DVX_MAX_ROWS` and can be removed entirely for streaming exports.

### The Dictionary Problem

MCP servers that register one tool per entity per operation face a combinatorial explosion. A typical Dynamics 365 org has 500+ entities — registering `create`, `read`, `update`, `delete`, and `query` for each produces 2,500+ tools. This overwhelms the agent's context window and makes tool selection unreliable.

dvx solves this with **meta-tools**:

1. `list_entities` — agent discovers what entities exist
2. `discover_entity` — agent inspects the schema of an entity it cares about
3. `execute_query` — agent runs any OData or FetchXML query
4. `execute_action` — agent invokes any custom action
5. `batch_execute` — agent runs multiple operations atomically

These 5 tools cover the **entire** Dataverse Web API surface. Optionally, `--entities account,contact` generates typed tools for specific entities when the agent benefits from schema-aware input validation.

---

## Use Cases by Domain

### Sales (Dynamics 365 Sales)

**Scenario: Pipeline analysis across all open opportunities**

With the official MCP server, an agent can retrieve at most 20 opportunities per query with no way to paginate. Analyzing a pipeline of 200 deals requires manual workarounds the agent can't perform.

With dvx:
```bash
# All open opportunities with estimated revenue, sorted by close date
dvx query --odata '/opportunities?$filter=statecode eq 0&$select=name,estimatedvalue,estimatedclosedate,_parentaccountid_value&$orderby=estimatedclosedate asc' --output ndjson

# FetchXML aggregate: total pipeline value by stage
dvx query --fetchxml '<fetch aggregate="true">
  <entity name="opportunity">
    <attribute name="estimatedvalue" alias="total" aggregate="sum"/>
    <attribute name="salesstagecode" alias="stage" groupby="true"/>
    <filter>
      <condition attribute="statecode" operator="eq" value="0"/>
    </filter>
  </entity>
</fetch>'
```

**Scenario: Qualify leads in bulk**

```bash
# Execute the QualifyLead action for a specific lead
dvx action QualifyLead --entity lead --id 00000000-0000-0000-0000-000000000001 \
  --json '{"CreateAccount": true, "CreateContact": true, "CreateOpportunity": true, "Status": 3}'
```

The official server has no way to execute custom actions like `QualifyLead`, `WinOpportunity`, or `CloseOpportunity`.

**Scenario: Bulk-update opportunity owners**

```bash
# Reassign 50 opportunities to a new owner in one atomic batch
dvx batch --file reassign-opportunities.json --atomic --as-user <manager-entra-id>
```

This uses batch operations (unavailable in the official server), atomic changesets (all-or-nothing), and impersonation (the operation runs as the manager).

---

### Customer Service (Dynamics 365 Service)

**Scenario: SLA compliance report across all active cases**

```bash
# All active cases with SLA status, ordered by priority
dvx query --fetchxml '<fetch>
  <entity name="incident">
    <attribute name="title"/>
    <attribute name="prioritycode"/>
    <attribute name="slainvokedid"/>
    <attribute name="createdon"/>
    <attribute name="_customerid_value"/>
    <filter>
      <condition attribute="statecode" operator="eq" value="0"/>
    </filter>
    <order attribute="prioritycode" descending="false"/>
  </entity>
</fetch>' --output ndjson
```

An agent processing this through the official server would see only the first 20 cases — useless for any SLA compliance analysis across a real case queue.

**Scenario: Route cases based on subject and workload**

```bash
# Discover the queue entity schema
dvx schema queue

# Query queue items to check workload
dvx query --odata '/queueitems?$filter=_queueid_value eq 00000000-...&$select=title,createdon' \
  --output ndjson

# Assign a case to a queue via action
dvx action AddToQueue --entity incident --id <case-id> \
  --json '{"Target": {"incidentid": "<case-id>", "@odata.type": "Microsoft.Dynamics.CRM.incident"}, "DestinationQueueId": "<queue-id>"}'
```

---

### Field Service (Dynamics 365 Field Service)

**Scenario: Technician schedule optimization**

```bash
# All unscheduled work orders with required skills
dvx query --fetchxml '<fetch>
  <entity name="msdyn_workorder">
    <attribute name="msdyn_name"/>
    <attribute name="msdyn_primaryincidenttype"/>
    <attribute name="msdyn_serviceterritory"/>
    <attribute name="msdyn_datewindowstart"/>
    <attribute name="msdyn_datewindowend"/>
    <filter>
      <condition attribute="msdyn_systemstatus" operator="eq" value="690970000"/>
    </filter>
  </entity>
</fetch>' --output ndjson

# Bookable resource availability
dvx query --odata '/bookableresources?$filter=resourcetype eq 3&$select=name,msdyn_primaryemail,timezone'
```

**Scenario: Complete a work order booking**

```bash
# Update booking status to completed
dvx update bookableresourcebooking <booking-id> \
  --json '{"bookingstatus@odata.bind": "/bookingstatuses(<completed-status-id>)"}'

# Create a service task completion record
dvx create msdyn_workorderservicetask \
  --json '{"msdyn_name": "Inspection complete", "msdyn_workorder@odata.bind": "/msdyn_workorders(<wo-id>)", "msdyn_percentcomplete": 100}'
```

---

### Marketing (Dynamics 365 Marketing / Customer Insights)

**Scenario: Campaign response analysis**

```bash
# All campaign responses with linked contacts
dvx query --fetchxml '<fetch>
  <entity name="campaignresponse">
    <attribute name="subject"/>
    <attribute name="receivedon"/>
    <attribute name="channeltypevalue"/>
    <link-entity name="contact" from="contactid" to="regardingobjectid" alias="c">
      <attribute name="fullname"/>
      <attribute name="emailaddress1"/>
    </link-entity>
    <filter>
      <condition attribute="createdon" operator="last-x-days" value="30"/>
    </filter>
  </entity>
</fetch>' --output ndjson
```

FetchXML's `link-entity` and temporal operators (`last-x-days`) are critical for marketing analytics but entirely unavailable through the official MCP server.

**Scenario: Bulk-create marketing list members**

```bash
# Add 100 contacts to a marketing list in one batch
dvx batch --file add-to-list.json --atomic
```

---

### Finance & Operations

**Scenario: Account reconciliation audit**

```bash
# All accounts with revenue changes in the last quarter
dvx query --fetchxml '<fetch>
  <entity name="account">
    <attribute name="name"/>
    <attribute name="revenue"/>
    <attribute name="modifiedon"/>
    <attribute name="modifiedby"/>
    <filter type="and">
      <condition attribute="modifiedon" operator="last-x-months" value="3"/>
      <condition attribute="revenue" operator="not-null"/>
    </filter>
    <order attribute="modifiedon" descending="true"/>
  </entity>
</fetch>' --output ndjson | wc -l
```

**Scenario: Bulk currency update**

```bash
# Update transaction currency for accounts moving to a new region
dvx batch --file currency-updates.json --atomic --dry-run
# Review the dry-run output, then execute
dvx batch --file currency-updates.json --atomic
```

The `--dry-run` flag lets agents (and humans) preview exactly what will happen before committing. The official server has no equivalent.

---

### Application Lifecycle Management (ALM)

**Scenario: Solution component inventory**

```bash
# List all solution components in a specific solution
dvx query --odata "/solutioncomponents?\$filter=_solutionid_value eq '<solution-id>'&\$select=componenttype,objectid,rootcomponentbehavior" \
  --page-all --output ndjson

# Discover custom entities added by a solution
dvx query --fetchxml '<fetch>
  <entity name="solutioncomponent">
    <attribute name="objectid"/>
    <attribute name="componenttype"/>
    <filter>
      <condition attribute="solutionid" operator="eq" value="<solution-id>"/>
      <condition attribute="componenttype" operator="eq" value="1"/>
    </filter>
  </entity>
</fetch>'
```

**Scenario: Environment comparison**

An agent can connect to two environments (via auth profiles) and diff entity schemas:

```bash
# Profile 1: dev environment
dvx auth select dev-org
dvx schema account --output json > /tmp/account-dev.json

# Profile 2: prod environment
dvx auth select prod-org
dvx schema account --output json > /tmp/account-prod.json

# Agent diffs the two JSON files to find schema drift
```

---

### Data Migration

**Scenario: Export and transform entity data**

```bash
# Stream all contacts as NDJSON for ETL processing
dvx query --odata '/contacts?$select=fullname,emailaddress1,telephone1,address1_city' \
  --page-all --output ndjson > contacts-export.ndjson

# Count before importing
wc -l contacts-export.ndjson

# Transform with jq and re-import
cat contacts-export.ndjson | jq '{name: .fullname, email: .emailaddress1}' | ...
```

**Scenario: Cross-environment data sync**

```bash
# Export from source
dvx auth select source-org
dvx query --fetchxml '<fetch>
  <entity name="account">
    <all-attributes/>
    <filter>
      <condition attribute="modifiedon" operator="last-x-days" value="1"/>
    </filter>
  </entity>
</fetch>' --output ndjson > delta-accounts.ndjson

# Import to target as batch
dvx auth select target-org
dvx batch --file import-batch.json --atomic
```

With a 20-row limit on the official server, any data migration involving more than 20 records is impossible without external tooling.

---

### Security & Administration

**Scenario: Audit user access and roles**

```bash
# All system users with their security roles
dvx query --fetchxml '<fetch>
  <entity name="systemuser">
    <attribute name="fullname"/>
    <attribute name="internalemailaddress"/>
    <attribute name="isdisabled"/>
    <link-entity name="systemuserroles" from="systemuserid" to="systemuserid" alias="ur">
      <link-entity name="role" from="roleid" to="roleid" alias="r">
        <attribute name="name"/>
      </link-entity>
    </link-entity>
    <filter>
      <condition attribute="isdisabled" operator="eq" value="0"/>
    </filter>
  </entity>
</fetch>' --output ndjson
```

**Scenario: Impersonation audit**

dvx's `--as-user` flag uses the `CallerObjectId` header, which means Dataverse's built-in audit trail records the impersonated user as the actor — not the service principal. This is critical for compliance:

```bash
# Create a record as a specific user (audit trail shows that user)
dvx create account --json '{"name": "Audit Test"}' --as-user <user-entra-id>
```

The official server has no impersonation support, so all operations are recorded under the service principal — losing the audit trail for per-user actions.

---

### Reporting & Analytics

**Scenario: Cross-entity aggregate report**

```bash
# Revenue by account industry
dvx query --fetchxml '<fetch aggregate="true">
  <entity name="account">
    <attribute name="revenue" alias="total_revenue" aggregate="sum"/>
    <attribute name="industrycode" alias="industry" groupby="true"/>
    <filter>
      <condition attribute="statecode" operator="eq" value="0"/>
      <condition attribute="revenue" operator="gt" value="0"/>
    </filter>
  </entity>
</fetch>'

# Case resolution time by priority (last 90 days)
dvx query --fetchxml '<fetch aggregate="true">
  <entity name="incident">
    <attribute name="prioritycode" alias="priority" groupby="true"/>
    <attribute name="incidentid" alias="count" aggregate="count"/>
    <filter>
      <condition attribute="statecode" operator="eq" value="1"/>
      <condition attribute="createdon" operator="last-x-days" value="90"/>
    </filter>
  </entity>
</fetch>'
```

FetchXML aggregation (`sum`, `count`, `avg`, `min`, `max` with `groupby`) is one of the most powerful Dataverse query capabilities and is completely unavailable through the official MCP server.

**Scenario: NDJSON pipeline for dashboards**

```bash
# Stream opportunity data into a visualization pipeline
dvx query --odata '/opportunities?$filter=statecode eq 0' \
  --fields name,estimatedvalue,estimatedclosedate \
  --page-all --output ndjson \
  | jq -c '{name, value: .estimatedvalue, close: .estimatedclosedate}' \
  | your-dashboard-tool --import
```

---

## When to Use the Official Server

The official Dataverse MCP Server may be appropriate when:

- You only need to read small datasets (under 20 records)
- Your use case is limited to simple CRUD on well-known entities
- You need .NET/C# integration rather than Node.js
- You want Microsoft's official support and maintenance guarantees

## When to Use dvx

dvx is the better choice when:

- You need to query more than 20 rows (any real reporting or analytics)
- You use FetchXML (aggregations, link-entities, temporal operators)
- You need batch operations (bulk creates, updates, or deletes)
- You need to execute custom actions (QualifyLead, WinOpportunity, etc.)
- You need impersonation for audit trail compliance
- You want a CLI for scripting and automation alongside MCP
- You need dry-run to preview mutations before executing
- You need NDJSON streaming for ETL pipelines
- You work across multiple environments with different schemas

## Server-Side Custom APIs vs Client-Side MCP Orchestration

Dataverse supports **Custom APIs** — server-side registered actions with typed parameters, transactional boundaries, and audit logging. These encode intent at design-time: `QualifyLead` is a single atomic operation that creates an account, contact, and opportunity in one transaction.

dvx's MCP approach encodes intent at **runtime**: an agent decides to create an account, then a contact, then an opportunity, coordinating the steps itself. This is more flexible but lacks the atomicity and server-side audit trail of a Custom API.

The ideal architecture uses **both**: Custom APIs for well-known business operations that need atomicity and compliance, and dvx's generic tools for ad-hoc exploration, reporting, and operations that don't have a pre-built Custom API.

```bash
# Use a Custom API when one exists
dvx action QualifyLead --entity lead --id <id> --json '{...}'

# Use generic tools for ad-hoc operations
dvx query --fetchxml '<fetch>...</fetch>'
dvx create contact --json '{...}'
```
