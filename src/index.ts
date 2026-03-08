import { Command, Option } from 'commander'
import { authCreate } from './commands/auth-create.js'
import { authList } from './commands/auth-list.js'
import { authSelect } from './commands/auth-select.js'
import { authLogin } from './commands/auth-login.js'
import { entities } from './commands/entities.js'
import { schema } from './commands/schema.js'
import { query } from './commands/query.js'
import { get } from './commands/get.js'
import { createRecord } from './commands/create.js'
import { updateRecord } from './commands/update.js'
import { upsertRecord } from './commands/upsert.js'
import { deleteRecord } from './commands/delete.js'
import { batch } from './commands/batch.js'
import { actionCommand } from './commands/action.js'
import { init } from './commands/init.js'
import { completion } from './commands/completion.js'

const program = new Command()

program
  .name('dvx')
  .description('Agent-first CLI for Microsoft Dataverse CE/Sales/Service')
  .version('0.1.0')

// Auth commands
const auth = program.command('auth').description('Manage authentication profiles')

auth
  .command('create')
  .description('Create a new authentication profile')
  .option('--service-principal', 'Use service principal authentication', true)
  .option('--name <name>', 'Profile name', 'default')
  .requiredOption('--environment-url <url>', 'Dataverse environment URL (e.g., https://org.crm.dynamics.com)')
  .requiredOption('--tenant-id <id>', 'Entra ID tenant ID')
  .requiredOption('--client-id <id>', 'App registration client ID')
  .option('--client-secret <secret>', 'Client secret (prefer DATAVERSE_CLIENT_SECRET env var)')
  .action(async (opts) => {
    await authCreate({
      name: opts.name,
      environmentUrl: opts.environmentUrl,
      tenantId: opts.tenantId,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    })
  })

auth
  .command('list')
  .description('List all authentication profiles')
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'table']).default('table'))
  .action(async (opts) => {
    await authList({ output: opts.output })
  })

auth
  .command('select')
  .description('Switch active authentication profile')
  .argument('<profile>', 'Profile name to activate')
  .action(async (profileName) => {
    await authSelect(profileName)
  })

auth
  .command('login')
  .description('Sign in with delegated (user) credentials via browser')
  .option('--name <name>', 'Profile name', 'default')
  .requiredOption('--environment-url <url>', 'Dataverse environment URL')
  .requiredOption('--tenant-id <id>', 'Entra tenant ID')
  .requiredOption('--client-id <id>', 'App registration client ID')
  .action(async (opts) => {
    await authLogin({ name: opts.name, environmentUrl: opts.environmentUrl, tenantId: opts.tenantId, clientId: opts.clientId })
  })

// Entity list
program
  .command('entities')
  .description('List all entities in the environment')
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'table']).default('table'))
  .action(async (opts) => {
    await entities({ output: opts.output })
  })

// Schema
program
  .command('schema')
  .description('Get entity schema with attribute definitions')
  .argument('<entity>', 'Entity logical name')
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'table']).default('json'))
  .option('--no-cache', 'Force live fetch, bypass cache')
  .option('--refresh', 'Invalidate cached schema for this entity before fetching')
  .option('--refresh-all', 'Clear entire schema cache before fetching')
  .action(async (entityName, opts) => {
    await schema(entityName, { output: opts.output, noCache: !opts.cache, refresh: opts.refresh, refreshAll: opts.refreshAll })
  })

// Query
program
  .command('query')
  .description('Query records using OData or FetchXML')
  .option('--odata <expression>', 'OData query expression (entitySetName?$filter=...)')
  .option('--fetchxml <xml>', 'FetchXML query string')
  .option('--file <path>', 'Read query from file (auto-detects OData or FetchXML)')
  .option('--fields <fields>', 'Comma-separated field names to select')
  .option('--page-all', 'Stream all pages as NDJSON', false)
  .option('--max-rows <n>', 'Maximum rows to return', parseInt)
  .option('--dry-run', 'Preview the operation without executing', false)
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'ndjson', 'table']).default('json'))
  .action(async (opts) => {
    await query({
      odata: opts.odata,
      fetchxml: opts.fetchxml,
      file: opts.file,
      fields: opts.fields,
      pageAll: opts.pageAll,
      maxRows: opts.maxRows,
      output: opts.output,
      dryRun: opts.dryRun,
    })
  })

// Get single record
program
  .command('get')
  .description('Get a single record by ID')
  .argument('<entity>', 'Entity logical name')
  .argument('<id>', 'Record GUID')
  .option('--fields <fields>', 'Comma-separated field names to select')
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'table']).default('json'))
  .action(async (entityName, id, opts) => {
    await get(entityName, id, { fields: opts.fields, output: opts.output })
  })

// Create
program
  .command('create')
  .description('Create a new record')
  .argument('<entity>', 'Entity logical name')
  .requiredOption('--json <data>', 'JSON payload for the record')
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (entityName, opts) => {
    await createRecord(entityName, { json: opts.json, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// Update
program
  .command('update')
  .description('Update an existing record')
  .argument('<entity>', 'Entity logical name')
  .argument('<id>', 'Record GUID')
  .requiredOption('--json <data>', 'JSON payload with fields to update')
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (entityName, id, opts) => {
    await updateRecord(entityName, id, { json: opts.json, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// Upsert
program
  .command('upsert')
  .description('Create or update a record based on a match field')
  .argument('<entity>', 'Entity logical name')
  .requiredOption('--match-field <field>', 'Field to match on for upsert')
  .requiredOption('--json <data>', 'JSON payload for the record')
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (entityName, opts) => {
    await upsertRecord(entityName, { matchField: opts.matchField, json: opts.json, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// Delete
program
  .command('delete')
  .description('Delete a record by ID')
  .argument('<entity>', 'Entity logical name')
  .argument('<id>', 'Record GUID')
  .option('--confirm', 'Skip confirmation prompt', false)
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (entityName, id, opts) => {
    await deleteRecord(entityName, id, { confirm: opts.confirm, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// Batch
program
  .command('batch')
  .description('Execute batch operations from a file')
  .requiredOption('--file <path>', 'JSON file with batch operations')
  .option('--atomic', 'Wrap operations in a changeset for atomicity', false)
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (opts) => {
    await batch({ file: opts.file, atomic: opts.atomic, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// Action
program
  .command('action')
  .description('Execute a Dataverse action or SDK message')
  .argument('<action>', 'Action name (PascalCase)')
  .requiredOption('--json <data>', 'JSON payload for the action')
  .option('--entity <entity>', 'Entity logical name for bound actions')
  .option('--id <id>', 'Record GUID for bound actions')
  .option('--dry-run', 'Preview the operation without executing', false)
  .option('--as-user <id>', 'Run as this Entra user object ID (CallerObjectId)')
  .addOption(new Option('--output <format>', 'Output format: json|table').choices(['json', 'table']).default('table'))
  .action(async (actionName, opts) => {
    await actionCommand(actionName, { json: opts.json, entity: opts.entity, id: opts.id, dryRun: opts.dryRun, callerObjectId: opts.asUser, output: opts.output })
  })

// MCP server
program
  .command('mcp')
  .description('Start MCP server for agent consumption')
  .option('--entities <entities>', 'Comma-separated entity logical names to scope tools')
  .option('--port <port>', 'Port for HTTP transport', parseInt)
  .addOption(new Option('--transport <transport>', 'Transport type: stdio|http').choices(['stdio', 'http']).default('stdio'))
  .action(async (options) => {
    const { startMcpServer } = await import('./mcp/server.js')
    await startMcpServer({
      entities: options.entities?.split(',').map((e: string) => e.trim()),
      transport: options.transport,
      port: options.port,
    })
  })

// Init wizard
program
  .command('init')
  .description('Interactive setup wizard for dvx')
  .action(async () => {
    await init()
  })

// Shell completion
program
  .command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type: bash, zsh, or powershell')
  .action((shell) => {
    completion(shell as 'bash' | 'zsh' | 'powershell')
  })

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
      if (process.env['DVX_DEBUG'] === 'true') {
        console.error(error.stack)
      }
    } else {
      console.error('Unknown error:', error)
    }
    process.exit(1)
  }
}

export default main
