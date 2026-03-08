# dvx Schema Skill

Patterns for discovering and interpreting Dataverse entity schemas.

## Schema Discovery Workflow

1. List all entities to find the logical name:
   ```
   dvx entities --output table
   ```

2. Get full schema for an entity:
   ```
   dvx schema <entity> --output json
   ```
   This returns `logicalName`, `entitySetName`, `primaryIdAttribute`, and all `attributes`.

3. In MCP context, use `discover_entity`:
   ```json
   { "entity_name": "opportunity" }
   ```

## EntityDefinitions Endpoint

The underlying API:
```
GET /api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName,...
GET /api/data/v9.2/EntityDefinitions(LogicalName='account')?$expand=Attributes(...)
```

Key EntityDefinition fields:
- `LogicalName` — snake_case identifier used in all API calls (e.g. `opportunityid`)
- `EntitySetName` — plural OData collection name (e.g. `opportunities`)
- `PrimaryIdAttribute` — GUID field name (e.g. `opportunityid`)
- `PrimaryNameAttribute` — display name field (e.g. `name`)

## AttributeDefinitions Interpretation

Each attribute has:

| Field            | Meaning                                            |
|------------------|----------------------------------------------------|
| `LogicalName`    | Field name for OData/FetchXML                      |
| `AttributeType`  | String, Integer, DateTime, Lookup, Picklist, etc.  |
| `RequiredLevel`  | None, Recommended, ApplicationRequired, SystemRequired |
| `IsCustomAttribute` | true = added by customisation, false = out-of-box |
| `MaxLength`      | String length limit                                |
| `Targets`        | For Lookup fields: target entity logical names     |

### Lookup field pattern

Lookup fields follow `<fieldname>id` naming. To set a lookup:
```json
{ "parentaccountid@odata.bind": "/accounts(<guid>)" }
```

### Picklist (OptionSet) fields

Values are integers. Use `dvx schema <entity>` to see `attributeType: "Picklist"`.
Retrieve option labels via:
```
GET /api/data/v9.2/EntityDefinitions(LogicalName='<entity>')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet
```

## FetchXML Examples

### Aggregate with linked entity

```xml
<fetch aggregate="true">
  <entity name="opportunity">
    <attribute name="estimatedvalue" aggregate="sum" alias="total"/>
    <link-entity name="account" from="accountid" to="parentaccountid" alias="acct">
      <attribute name="name" groupby="true" alias="account_name"/>
    </link-entity>
    <filter><condition attribute="statecode" operator="eq" value="0"/></filter>
  </entity>
</fetch>
```

### Paging (automatic with dvx)

dvx handles paging cookies automatically when streaming FetchXML results.
Use `dvx query --fetchxml '<fetch top="5000">...' --entity <entity>`.

### Date-relative operators

FetchXML supports: `today`, `this-week`, `this-month`, `this-year`,
`last-x-days`, `next-x-hours`, `on-or-after`, `on-or-before`.

## Common Field Naming Conventions

- ID fields: `<entityname>id` (e.g. `accountid`, `contactid`)
- Owner: `ownerid` (polymorphic — user or team)
- Status: `statecode` (main state) + `statuscode` (reason, depends on statecode)
- Created/Modified: `createdon`, `modifiedon` (read-only)
- Custom fields: prefixed with publisher prefix (e.g. `new_`, `cr123_`)
- Money fields: `<field>` (base currency) + `<field>_base` (org base currency)
