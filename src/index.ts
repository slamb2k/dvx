import { Command, Option } from 'commander'
import { authLogin, authLogout } from './commands/auth-login.js'
import { authList } from './commands/auth-list.js'
import { authSelect } from './commands/auth-select.js'
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
import { demo } from './commands/demo.js'
import { completion } from './commands/completion.js'
import { createRequire } from 'node:module'
import { setUxOptions, logError, logInfo, stripAnsi } from './utils/cli.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

const BANNER = `
\x1b[36m{_____    {__         {__\x1b[0m\x1b[33m{__      {__\x1b[0m
\x1b[36m{__   {__  {__       {__  \x1b[0m\x1b[33m{__   {__\x1b[0m
\x1b[36m{__    {__  {__     {__    \x1b[0m\x1b[33m{__ {__\x1b[0m
\x1b[36m{__    {__   {__   {__     \x1b[0m\x1b[33m  {__\x1b[0m
\x1b[36m{__    {__    {__ {__      \x1b[0m\x1b[33m{__ {__\x1b[0m        \x1b[2mAgent-first CLI/MCP for\x1b[0m
\x1b[36m{__   {__      {____      \x1b[0m\x1b[33m{__   {__\x1b[0m       \x1b[2mMicrosoft Dataverse\x1b[0m
\x1b[36m{_____          {__      \x1b[0m\x1b[33m{__      {__\x1b[0m     \x1b[2mv${version}\x1b[0m
`

const program = new Command()

program
  .name('dvx')
  .description('Agent-first CLI for Microsoft Dataverse CE/Sales/Service')
  .version(version)
  .option('--no-color', 'Disable color output')
  .option('--quiet', 'Suppress all progress output')
  .addHelpText('before', () => {
    const opts = program.opts()
    return opts.color === false ? stripAnsi(BANNER) : BANNER
  })
  .action(() => {
    program.outputHelp()
  })

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals()
  setUxOptions({
    quiet: opts.quiet ?? false,
    noColor: opts.color === false,
  })
})

// Auth commands
const auth = program.command('auth').description('Manage authentication profiles')

auth
  .command('login')
  .description('Sign in to a Dataverse environment')
  .option('--name <name>', 'Profile name', 'default')
  .option('--url <url>', 'Dataverse environment URL (auto-discovered if omitted)')
  .option('--tenant-id <id>', 'Entra tenant ID (auto-detected from sign-in if omitted)')
  .option('--client-id <id>', 'App registration client ID (auto-created if omitted)')
  .option('--service-principal', 'Use service principal (client credentials) auth')
  .option('--client-secret <secret>', 'Client secret (prefer DATAVERSE_CLIENT_SECRET env var)')
  .action(async (opts) => {
    await authLogin({
      name: opts.name,
      url: opts.url,
      tenantId: opts.tenantId,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      servicePrincipal: opts.servicePrincipal,
    })
  })

auth
  .command('logout')
  .description('Remove auth profile')
  .option('--all', 'Remove all profiles')
  .action(async (opts) => {
    await authLogout({ all: opts.all })
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

// Entity list
program
  .command('entities')
  .description('List all entities in the environment')
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'table', 'ndjson']).default('table'))
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

// Demo
program
  .command('demo')
  .description('Run interactive demo showcasing dvx capabilities')
  .addOption(new Option('--tier <tier>', 'Demo depth tier').choices(['read', 'write', 'full']))
  .action(async (opts) => {
    await demo({ tier: opts.tier })
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

// Shell completion
program
  .command('completion')
  .description('Generate shell completion script')
  .argument('<shell>', 'Shell type: bash, zsh, or powershell')
  .action((shell) => {
    completion(shell as 'bash' | 'zsh' | 'powershell')
  })

function getHint(error: Error, argv: string[]): string | undefined {
  const msg = error.message
  const args = argv.join(' ')

  // Shell expansion of $variables in OData queries
  if (msg.includes('Bad Request') && args.includes('--odata')) {
    const odataArg = argv[argv.indexOf('--odata') + 1] ?? ''
    if (odataArg.includes('?=') || odataArg.includes('&=') || !odataArg.includes('$')) {
      return "Use single quotes to prevent shell expansion of $ in OData: --odata '/entities?$top=10'"
    }
  }

  // No auth profile configured
  if (error.name === 'AuthProfileNotFoundError') {
    return 'Run `dvx auth login` to set up authentication.'
  }

  // Profile already exists
  if (error.name === 'AuthProfileExistsError') {
    return 'Use `dvx auth select <name>` to switch profiles, or `dvx auth logout` to remove the existing one.'
  }

  // Token acquisition failure
  if (error.name === 'TokenAcquisitionError' && msg.includes('Client secret not found')) {
    return 'Set DATAVERSE_CLIENT_SECRET env var, or use `dvx auth login` for delegated (browser) auth.'
  }

  // Entity not found
  if (error.name === 'EntityNotFoundError') {
    return 'Run `dvx entities` to list available entities. Entity names are singular (e.g., "account" not "accounts").'
  }

  // Record not found (bad GUID)
  if (error.name === 'RecordNotFoundError') {
    return 'Verify the record ID is correct. Use `dvx query` to search for records.'
  }

  // GUID validation
  if (error.name === 'ValidationError' && msg.includes('GUID')) {
    return 'GUIDs must be in format: 00000000-0000-0000-0000-000000000000'
  }

  // Impersonation
  if (error.name === 'ImpersonationPrivilegeError') {
    return 'The application user needs the prvActOnBehalfOfAnotherUser privilege. Assign it via a security role in Dataverse admin.'
  }

  // FetchXML parsing
  if (error.name === 'FetchXmlValidationError') {
    return 'Wrap FetchXML in single quotes to prevent shell interpretation of < and > characters.'
  }

  // HTTP 401
  if (error.name === 'DataverseError' && msg.includes('401')) {
    return 'Authentication expired or invalid. Run `dvx auth login` to re-authenticate.'
  }

  // HTTP 403
  if (error.name === 'DataverseError' && msg.includes('403')) {
    return 'Check that the authenticated user/app has the required security role in Dataverse.'
  }

  // JSON parse errors in --json flag
  if (msg.includes('JSON') || msg.includes('Unexpected token')) {
    if (args.includes('--json')) {
      return "Ensure --json value is valid JSON. Use single quotes around the value: --json '{\"name\": \"value\"}'"
    }
  }

  return undefined
}

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    if (error instanceof Error) {
      logError(error.message)
      const hint = getHint(error, process.argv)
      if (hint) {
        logInfo(hint)
      }
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

main()
