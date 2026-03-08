# dvx Sales Skill

Domain knowledge for Dynamics 365 Sales entities and workflows.

## Key Entities

- `opportunity` — Sales deal in progress
- `lead` — Unqualified prospect
- `quote` — Price quote for a deal
- `salesorder` — Confirmed order (converted from quote)
- `invoice` — Billing document
- `account` — Customer organisation
- `contact` — Individual person at an account

## Opportunity Lifecycle

Opportunities move through stages tracked by `statecode` and `statuscode`:

| statecode | statuscode | Meaning           |
|-----------|------------|-------------------|
| 0         | 1          | Open (In Progress)|
| 1         | 2          | Won               |
| 2         | 3          | Lost              |
| 2         | 4          | Cancelled         |
| 2         | 5          | Out-sold          |

Key fields: `name`, `estimatedvalue`, `actualvalue`, `actualclosedate`,
`estimatedclosedate`, `closeprobability`, `parentaccountid`, `parentcontactid`,
`stageid`, `processid`, `stepname`.

## Stage Transitions (Actions)

### WinOpportunity (bound to opportunity)

```
dvx action WinOpportunity \
  --entity opportunity \
  --id <opportunityid> \
  --json '{"Status":3}'
```

### LoseOpportunity (bound to opportunity)

```
dvx action LoseOpportunity \
  --entity opportunity \
  --id <opportunityid> \
  --json '{"OpportunityClose":{"subject":"Lost","opportunityid@odata.bind":"/opportunities(<id>)"},"Status":4}'
```

## Lead Qualification

Use `QualifyLead` to convert a lead into account/contact/opportunity:

```
dvx action QualifyLead \
  --entity lead \
  --id <leadid> \
  --json '{
    "CreateAccount": true,
    "CreateContact": true,
    "CreateOpportunity": true,
    "Status": 3
  }'
```

## Common FetchXML Patterns

### Pipeline report (open opportunities by owner)

```xml
<fetch aggregate="true">
  <entity name="opportunity">
    <attribute name="ownerid" groupby="true" alias="owner"/>
    <attribute name="estimatedvalue" aggregate="sum" alias="pipeline"/>
    <attribute name="opportunityid" aggregate="count" alias="count"/>
    <filter><condition attribute="statecode" operator="eq" value="0"/></filter>
  </entity>
</fetch>
```

```
dvx query --fetchxml '<fetch...>' --entity opportunity
```

### Opportunities closing this month

```xml
<fetch top="50">
  <entity name="opportunity">
    <attribute name="name"/><attribute name="estimatedvalue"/>
    <attribute name="estimatedclosedate"/>
    <filter type="and">
      <condition attribute="statecode" operator="eq" value="0"/>
      <condition attribute="estimatedclosedate" operator="this-month"/>
    </filter>
    <order attribute="estimatedclosedate"/>
  </entity>
</fetch>
```

## Notes

- `actualvalue` is only populated after WinOpportunity; use `estimatedvalue` for open opps.
- `closeprobability` (0-100) is typically set by the sales process stage.
- Quote → Order → Invoice follow separate statecode flows.
- Lead `statuscode` 3 = Qualified (not to be confused with opportunity Won).
