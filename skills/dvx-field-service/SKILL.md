# dvx-field-service Skill

## Key Entities

| Logical Name | Display Name | Purpose |
|---|---|---|
| `msdyn_workorder` | Work Order | Core field service entity; tracks work to be performed |
| `msdyn_bookableresource` | Bookable Resource | Technician, crew, equipment, or facility |
| `msdyn_bookableresourcebooking` | Bookable Resource Booking | Scheduled assignment of a resource to a time slot |
| `msdyn_resourcerequirement` | Resource Requirement | Demand-side specification for scheduling |
| `msdyn_workorderincident` | Work Order Incident | Line item linking an incident type to a work order |
| `msdyn_customerasset` | Customer Asset | Asset installed at a customer site |

## Work Order Lifecycle

```
Open-Unscheduled → Open-Scheduled → Open-In Progress → Open-Completed → Closed-Posted
```

Status is tracked on `msdyn_systemstatus` (option set) and `msdyn_substatus` (lookup).

Key status values:
- `690970000` — Open-Unscheduled
- `690970001` — Open-Scheduled
- `690970002` — Open-In Progress
- `690970003` — Open-Completed
- `690970004` — Closed-Posted

## Scheduling

Work orders generate `msdyn_resourcerequirement` records that drive the Schedule Board.

Bookings (`msdyn_bookableresourcebooking`) link:
- `msdyn_resourcerequirement` — the demand
- `resource` — the bookable resource (technician)
- `starttime` / `endtime` — the appointment window
- `bookingstatus` — Scheduled, Traveling, In Progress, Completed, Canceled

## Common Work Order Fields

| Field | Type | Notes |
|---|---|---|
| `msdyn_serviceaccount` | Lookup (account) | Customer being serviced |
| `msdyn_billingaccount` | Lookup (account) | Payer if different from service account |
| `msdyn_primaryincidenttype` | Lookup (msdyn_incidenttype) | Primary problem type |
| `msdyn_workorderstatus` | Option Set | Mirrors system status |
| `msdyn_workordertype` | Lookup | Categorizes the work |
| `msdyn_priority` | Lookup | Urgency |
| `msdyn_territory` | Lookup | Service territory constraint |
| `msdyn_timefrompromised` / `msdyn_timetopromised` | DateTime | SLA window |

## Territory and Resource Constraints

Resources are associated with territories via `msdyn_resourceterritory`. Work orders are assigned a `msdyn_territory`. The Schedule Board filters available resources by matching territories.

Resource characteristics (`msdyn_resourcecharacteristic`) link skills/certifications to resources. Requirements can specify required characteristics to filter eligible resources.

## Integration with Incidents (Cases)

Field Service integrates with Customer Service via `incident` (case) → work order conversion. The `msdyn_incidenttype` drives auto-population of:
- Service tasks (`msdyn_workorderservicetask`)
- Products (`msdyn_workorderproduct`)
- Services (`msdyn_workorderservice`)

To query work orders for a specific account:
```
dvx query --odata "msdyn_workorders?\$filter=_msdyn_serviceaccount_value eq <account-guid>&\$select=msdyn_workorderid,msdyn_name,msdyn_systemstatus"
```
