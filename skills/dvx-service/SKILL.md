# dvx Service Skill

Domain knowledge for Dynamics 365 Customer Service entities and workflows.

## Key Entities

- `incident` — Support case (the core service entity)
- `queue` — Work routing destination
- `queueitem` — Assignment of a record to a queue
- `sla` — Service Level Agreement definition
- `slaitem` — Individual KPI within an SLA (e.g. first response, resolution)
- `slakpiinstance` — Runtime instance tracking SLA compliance for a case
- `knowledgearticle` — Knowledge base article
- `activitypointer` — Parent of email, phone call, task, appointment

## Case Management (incident)

Key fields:

| Field            | Description                                           |
|------------------|-------------------------------------------------------|
| `ticketnumber`   | Auto-generated case number (e.g. CAS-00001-XXXXX)     |
| `title`          | Case subject                                          |
| `statecode`      | 0=Active, 1=Resolved, 2=Cancelled                     |
| `statuscode`     | 1=In Progress, 2=On Hold, 3=Waiting, 5=Problem Solved |
| `prioritycode`   | 1=High, 2=Normal, 3=Low                               |
| `casetypecode`   | 1=Question, 2=Problem, 3=Request                      |
| `customerid`     | Linked account or contact (polymorphic)               |
| `slainvokedid`   | SLA currently governing this case                     |
| `firstresponsebydateincludepauses` | First response deadline         |
| `resolvebydeadlineincludepauses`   | Resolution deadline              |

## SLA Breach Detection

`slakpiinstance` records are created per SLA KPI. Check `status`:
- 0 = In Progress
- 1 = Succeeded
- 2 = Noncompliant (breached)
- 3 = Nearing Noncompliance (warning)
- 4 = Paused
- 5 = Succeeded (out of SLA)

```
dvx query --odata "slakpiinstances?$filter=status eq 2&$select=name,regardingobjectid,failuretime"
```

## Queue Routing

### RouteCaseToQueue (bound to incident)

```
dvx action AddToQueue \
  --json '{
    "Target": {"@odata.type":"Microsoft.Dynamics.CRM.incident","incidentid":"<id>"},
    "DestinationQueue": {"@odata.id":"queues(<queueid>)"}
  }'
```

Note: `AddToQueue` is an unbound action. `RouteCaseToQueue` is the older SDK message.

## Escalation Patterns

1. Change `prioritycode` to 1 (High) via `dvx update incident <id> --json '{"prioritycode":1}'`
2. Re-route to escalation queue via `AddToQueue` action
3. Add a note (annotation entity) to document the escalation reason

## Common FetchXML Patterns

### Open cases with SLA breach risk

```xml
<fetch top="20">
  <entity name="incident">
    <attribute name="ticketnumber"/><attribute name="title"/>
    <attribute name="prioritycode"/><attribute name="resolvebydeadlineincludepauses"/>
    <filter type="and">
      <condition attribute="statecode" operator="eq" value="0"/>
      <condition attribute="resolvebydeadlineincludepauses" operator="next-x-hours" value="4"/>
    </filter>
    <order attribute="resolvebydeadlineincludepauses"/>
  </entity>
</fetch>
```

### Cases per queue

```xml
<fetch aggregate="true">
  <entity name="queueitem">
    <attribute name="queueid" groupby="true" alias="queue"/>
    <attribute name="queueitemid" aggregate="count" alias="count"/>
    <link-entity name="incident" from="incidentid" to="objectid" alias="inc">
      <filter><condition attribute="statecode" operator="eq" value="0"/></filter>
    </link-entity>
  </entity>
</fetch>
```

## Notes

- Resolving a case requires setting `statecode=1` and providing a `resolutiontype` via the `CloseIncident` action; direct PATCH of `statecode` is rejected by the platform.
- Knowledge article approval workflow: `statecode` 0=Draft, 3=Approved, 7=Published. Publishing requires `PublishKnowledgeArticle` action.
