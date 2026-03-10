import * as clack from '@clack/prompts'
import { createClient } from '../client/create-client.js'
import { buildBatchBody, type BatchOperation } from '../utils/batch-builder.js'
import { renderTable } from '../utils/table.js'
import { DataverseError, EntityNotFoundError, ImpersonationPrivilegeError, ValidationError } from '../errors.js'
import { createSpinner, isInteractive, logWarn, type SpinnerHandle } from '../utils/cli.js'
import type { DataverseClient } from '../client/dataverse-client.js'

type DemoTier = 'read' | 'write' | 'full'

interface DemoOptions {
  tier?: DemoTier | undefined
  output?: 'json' | 'table' | undefined
}

interface DemoResult {
  name: string
  status: 'pass' | 'skip' | 'fail'
  elapsedMs: number
  error?: string
}

interface DemoContext {
  client: DataverseClient
  createdIds: Map<string, string>
  hasOpportunity: boolean
}

interface DemoStep {
  name: string
  tier: DemoTier
  callout: string
  run: (ctx: DemoContext, s: SpinnerHandle) => Promise<string | void>
}

const DEMO_PREFIX = '[dvx-demo]'

const TIER_ORDER: DemoTier[] = ['read', 'write', 'full']

function callout(msg: string): void {
  const text = `\u26A1 dvx advantage: ${msg}`
  if (isInteractive()) {
    clack.log.info(text)
  } else {
    process.stderr.write(`${text}\n`)
  }
}

async function selectTier(options: DemoOptions): Promise<DemoTier> {
  if (options.tier) return options.tier

  if (!isInteractive()) {
    throw new ValidationError('--tier is required in non-interactive mode (choices: read, write, full)')
  }

  const result = await clack.select({
    message: 'Select demo tier',
    options: [
      { value: 'read' as const, label: 'Read', hint: 'Schema discovery, queries, FetchXML — no data changes' },
      { value: 'write' as const, label: 'Write', hint: 'Read + CRUD lifecycle with auto-cleanup' },
      { value: 'full' as const, label: 'Full', hint: 'Write + batch, actions, impersonation, aggregation' },
    ],
  })

  if (clack.isCancel(result)) {
    clack.cancel('Demo cancelled.')
    process.exit(0)
  }

  return result as DemoTier
}

async function checkOpportunityAvailable(client: DataverseClient): Promise<boolean> {
  try {
    await client.getEntitySchema('opportunity')
    return true
  } catch (err) {
    if (err instanceof EntityNotFoundError) return false
    if (err instanceof DataverseError && (err.statusCode === 404 || err.message.includes('does not exist'))) return false
    throw err
  }
}

function logData(text: string): void {
  if (isInteractive()) {
    clack.log.step(text)
  } else {
    console.log(text)
  }
}

function formatRecords(records: Record<string, unknown>[], maxRows = 5): string {
  if (records.length === 0) return '(no records)'
  const subset = records.slice(0, maxRows)
  const keys = Object.keys(subset[0]!)
  const rows = subset.map((r) => keys.map((k) => String(r[k] ?? '')))
  let out = renderTable(rows, keys, { dimHeaders: true })
  if (records.length > maxRows) out += `\n  ... and ${records.length - maxRows} more`
  return out
}

async function runStep(step: DemoStep, ctx: DemoContext): Promise<DemoResult> {
  const s = createSpinner()
  const start = performance.now()
  try {
    s.start(step.name)
    const output = await step.run(ctx, s)
    s.stop(step.name)
    if (output) logData(output)
    callout(step.callout)
    return { name: step.name, status: 'pass', elapsedMs: Math.round(performance.now() - start) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    s.error(`${step.name} — ${msg}`)
    if (err instanceof ImpersonationPrivilegeError) {
      return { name: step.name, status: 'skip', elapsedMs: Math.round(performance.now() - start), error: msg }
    }
    return { name: step.name, status: 'fail', elapsedMs: Math.round(performance.now() - start), error: msg }
  }
}

async function cleanup(client: DataverseClient, createdIds: Map<string, string>): Promise<void> {
  // Delete tracked records in reverse order (contacts before accounts)
  const entries = [...createdIds.entries()].reverse()
  for (const [entity, id] of entries) {
    try {
      await client.deleteRecord(entity, id)
    } catch {
      logWarn(`Cleanup: failed to delete ${entity} ${id}`)
    }
  }

  // Sweep for orphan demo records
  try {
    const orphans = await client.query('accounts', `$filter=startswith(name,'${DEMO_PREFIX}')&$select=accountid`)
    for (const orphan of orphans) {
      const id = orphan['accountid'] as string | undefined
      if (id) {
        try {
          await client.deleteRecord('account', id)
        } catch {
          logWarn(`Cleanup: failed to delete orphan account ${id}`)
        }
      }
    }
  } catch {
    logWarn('Cleanup: orphan sweep failed')
  }

  try {
    const orphanContacts = await client.query('contacts', `$filter=startswith(firstname,'${DEMO_PREFIX}')&$select=contactid`)
    for (const orphan of orphanContacts) {
      const id = orphan['contactid'] as string | undefined
      if (id) {
        try {
          await client.deleteRecord('contact', id)
        } catch {
          logWarn(`Cleanup: failed to delete orphan contact ${id}`)
        }
      }
    }
  } catch {
    logWarn('Cleanup: contact orphan sweep failed')
  }
}

function renderSummary(results: DemoResult[]): void {
  const rows = results.map((r) => {
    let status: string
    switch (r.status) {
      case 'pass': status = '\x1b[32mPASS\x1b[0m'; break
      case 'skip': status = '\x1b[33mSKIP\x1b[0m'; break
      case 'fail': status = '\x1b[31mFAIL\x1b[0m'; break
    }
    return [r.name, status, `${r.elapsedMs}ms`]
  })
  console.log(renderTable(rows, ['Demo', 'Status', 'Elapsed'], { dimHeaders: true }))
}

const ALL_DEMO_STEPS: DemoStep[] = [
  // === Read tier ===
  {
    name: 'List entities',
    tier: 'read',
    callout: 'Full entity catalog with display names — native MCP only exposes pre-configured entities',
    async run(ctx, s) {
      const list = await ctx.client.listEntities()
      s.message(`Found ${list.length} entities`)
      const sample = list.slice(0, 8)
      const rows = sample.map((e) => [e.logicalName, e.displayName, e.entitySetName])
      let out = renderTable(rows, ['Logical Name', 'Display Name', 'Entity Set'], { dimHeaders: true })
      if (list.length > 8) out += `\n  ... and ${list.length - 8} more`
      return out
    },
  },
  {
    name: 'Schema introspection',
    tier: 'read',
    callout: 'Live schema with attribute types and required levels — native MCP has no schema introspection',
    async run(ctx, s) {
      const schema = await ctx.client.getEntitySchema('account')
      s.message(`account: ${schema.attributes.length} attributes`)
      const sample = schema.attributes.slice(0, 8)
      const rows = sample.map((a) => [a.logicalName, a.attributeType, a.requiredLevel])
      let out = renderTable(rows, ['Attribute', 'Type', 'Required'], { dimHeaders: true })
      if (schema.attributes.length > 8) out += `\n  ... and ${schema.attributes.length - 8} more`
      return out
    },
  },

  // === Write tier (create data before read steps query it) ===
  {
    name: 'Create account',
    tier: 'write',
    callout: 'Create with auto-schema resolution — dvx maps logical name to entity set automatically',
    async run(ctx) {
      const id = await ctx.client.createRecord('account', {
        name: `${DEMO_PREFIX} Contoso Ltd`,
        description: 'Demo account created by dvx demo — will be auto-cleaned',
      })
      ctx.createdIds.set('account', id)
      return `Created account ${id}`
    },
  },
  {
    name: 'Update account',
    tier: 'write',
    callout: 'Partial update via PATCH — only changed fields sent, not full record replacement',
    async run(ctx) {
      const id = ctx.createdIds.get('account')
      if (!id) throw new Error('No account to update — create step must run first')
      await ctx.client.updateRecord('account', id, {
        websiteurl: 'https://dvx.dev',
        telephone1: '+1-555-DVX-DEMO',
      })
      return `Updated ${id}: websiteurl, telephone1`
    },
  },
  {
    name: 'Upsert contact',
    tier: 'write',
    callout: 'Upsert with alternate key matching — dvx resolves match fields automatically',
    async run(ctx) {
      const accountId = ctx.createdIds.get('account')
      const id = await ctx.client.createRecord('contact', {
        firstname: `${DEMO_PREFIX}`,
        lastname: 'Demo User',
        emailaddress1: 'demo@dvx.dev',
        ...(accountId ? { 'parentcustomerid_account@odata.bind': `/accounts(${accountId})` } : {}),
      })
      ctx.createdIds.set('contact', id)
      return `Created contact ${id}${accountId ? ` (linked to account ${accountId})` : ''}`
    },
  },

  // === Read tier (queries — run after write tier creates data) ===
  {
    name: 'OData query',
    tier: 'read',
    callout: 'Full OData $filter/$orderby/$select/$expand — native MCP limited to basic retrieval',
    async run(ctx, s) {
      const results = await ctx.client.query('accounts', "$filter=startswith(name,'[dvx-demo]')&$orderby=name&$top=5&$select=name,accountid")
      s.message(`${results.length} account(s) matched`)
      return formatRecords(results)
    },
  },
  {
    name: 'FetchXML with joins',
    tier: 'read',
    callout: 'FetchXML with linked entities and paging — native MCP has no FetchXML support',
    async run(ctx, s) {
      const fetchXml = `<fetch top="5">
  <entity name="account">
    <attribute name="name" />
    <attribute name="accountid" />
    <filter>
      <condition attribute="name" operator="like" value="${DEMO_PREFIX}%" />
    </filter>
    <link-entity name="contact" from="parentcustomerid" to="accountid" link-type="outer">
      <attribute name="fullname" />
    </link-entity>
  </entity>
</fetch>`
      const results = await ctx.client.queryFetchXml('account', fetchXml) as Record<string, unknown>[]
      s.message(`${results.length} record(s) with linked contacts`)
      return formatRecords(results)
    },
  },
  {
    name: 'Get single record',
    tier: 'read',
    callout: 'Field-level $select on single record — native MCP returns all fields always',
    async run(ctx, s) {
      const list = await ctx.client.query('accounts', '$top=1&$select=accountid,name')
      if (list.length === 0) {
        s.message('No accounts available')
        return
      }
      const id = list[0]!['accountid'] as string
      const record = await ctx.client.getRecord('account', id, ['name', 'createdon'])
      s.message(`Retrieved: ${(record['name'] as string) ?? id}`)
      const keys = Object.keys(record)
      const rows = keys.map((k) => [k, String(record[k] ?? '')])
      return renderTable(rows, ['Field', 'Value'], { dimHeaders: true })
    },
  },

  // === Write tier (delete) ===
  {
    name: 'Delete record',
    tier: 'write',
    callout: 'Delete with GUID validation and confirmation — dvx validates before sending to API',
    async run(ctx) {
      const id = ctx.createdIds.get('account')
      if (!id) throw new Error('No account to delete — create step must run first')
      await ctx.client.deleteRecord('account', id)
      ctx.createdIds.delete('account')
      return `Deleted account ${id}`
    },
  },

  // === Full tier ===
  {
    name: 'Batch atomic create',
    tier: 'full',
    callout: 'Atomic batch with changeset — all-or-nothing, 1000 ops/request — native MCP has no batch',
    async run(ctx) {
      const ops: BatchOperation[] = Array.from({ length: 5 }, (_, i) => ({
        method: 'POST' as const,
        path: 'accounts',
        body: { name: `${DEMO_PREFIX} Batch ${i + 1}` },
      }))
      const boundary = `batch_dvx_demo_${Date.now()}`
      const body = buildBatchBody(ops, boundary, { atomic: true })
      await ctx.client.executeBatch(body, boundary)
      return `5 accounts created atomically in a single changeset`
    },
  },
  {
    name: 'WhoAmI action',
    tier: 'full',
    callout: 'Custom action execution — call any action/SDK message — native MCP cannot call actions',
    async run(ctx, s) {
      const result = await ctx.client.executeAction('WhoAmI', {}) as Record<string, unknown>
      const userId = result['UserId'] as string | undefined
      if (userId) s.message(`Authenticated as ${userId}`)
      const keys = Object.keys(result)
      const rows = keys.map((k) => [k, String(result[k] ?? '')])
      return renderTable(rows, ['Field', 'Value'], { dimHeaders: true })
    },
  },
  {
    name: 'Impersonated query',
    tier: 'full',
    callout: 'CallerObjectId impersonation — run as another user for audit trails',
    async run(ctx, s) {
      // Use WhoAmI to get current user, then impersonate as self (safe)
      const whoami = await ctx.client.executeAction('WhoAmI', {}) as Record<string, unknown>
      const userId = whoami['UserId'] as string | undefined
      if (!userId) {
        s.message('Could not determine user ID — skipping impersonation')
        return
      }
      const { client: impersonatedClient } = await createClient({ callerObjectId: userId })
      const results = await impersonatedClient.query('accounts', '$top=1&$select=name')
      s.message(`Impersonated query returned ${results.length} record(s)`)
      return formatRecords(results)
    },
  },
  {
    name: 'FetchXML aggregation',
    tier: 'full',
    callout: 'FetchXML aggregation with groupby — server-side analytics, not possible via native MCP',
    async run(ctx, s) {
      const fetchXml = `<fetch aggregate="true">
  <entity name="account">
    <attribute name="statecode" groupby="true" alias="state" />
    <attribute name="accountid" aggregate="count" alias="count" />
  </entity>
</fetch>`
      const results = await ctx.client.queryFetchXml('account', fetchXml) as Record<string, unknown>[]
      s.message(`${results.length} state group(s)`)
      return formatRecords(results)
    },
  },
]

export async function demo(options: DemoOptions): Promise<void> {
  const selectedTier = await selectTier(options)

  if (isInteractive()) {
    clack.intro(`dvx demo \u2014 ${selectedTier} tier`)
  }

  const { client } = await createClient()
  const hasOpportunity = await checkOpportunityAvailable(client)

  const maxIdx = TIER_ORDER.indexOf(selectedTier)
  const activeSteps = ALL_DEMO_STEPS.filter((s) => TIER_ORDER.indexOf(s.tier) <= maxIdx)

  const ctx: DemoContext = { client, createdIds: new Map(), hasOpportunity }
  const results: DemoResult[] = []
  const totalStart = performance.now()

  try {
    for (const step of activeSteps) {
      const result = await runStep(step, ctx)
      results.push(result)
    }
  } finally {
    if (ctx.createdIds.size > 0) {
      const s = createSpinner()
      s.start('Cleaning up demo data...')
      await cleanup(client, ctx.createdIds)
      s.stop('Cleanup complete')
    }
    // Always run orphan sweep for batch-created records
    if (TIER_ORDER.indexOf(selectedTier) >= TIER_ORDER.indexOf('full')) {
      const s = createSpinner()
      s.start('Sweeping orphan demo records...')
      await cleanup(client, new Map())
      s.stop('Orphan sweep complete')
    }
  }

  const totalMs = Math.round(performance.now() - totalStart)
  const passed = results.filter((r) => r.status === 'pass').length

  if (options.output === 'json') {
    console.log(JSON.stringify({
      tier: selectedTier,
      totalMs,
      passed,
      total: results.length,
      results: results.map((r) => ({ name: r.name, status: r.status, elapsedMs: r.elapsedMs, ...(r.error ? { error: r.error } : {}) })),
    }, null, 2))
  } else {
    console.log('')
    renderSummary(results)
  }

  if (isInteractive()) {
    clack.outro(`${passed}/${results.length} demos passed in ${totalMs}ms`)
  }
}
