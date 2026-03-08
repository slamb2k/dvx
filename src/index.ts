import { Command, Option } from 'commander'
import { authCreate } from './commands/auth-create.js'
import { authList } from './commands/auth-list.js'
import { authSelect } from './commands/auth-select.js'
import { entities } from './commands/entities.js'
import { schema } from './commands/schema.js'
import { query } from './commands/query.js'
import { get } from './commands/get.js'

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
  .action(async (entityName, opts) => {
    await schema(entityName, { output: opts.output, noCache: !opts.cache })
  })

// Query
program
  .command('query')
  .description('Query records using OData')
  .requiredOption('--odata <expression>', 'OData query expression (entitySetName?$filter=...)')
  .option('--fields <fields>', 'Comma-separated field names to select')
  .option('--page-all', 'Stream all pages as NDJSON', false)
  .option('--max-rows <n>', 'Maximum rows to return', parseInt)
  .addOption(new Option('--output <format>', 'Output format').choices(['json', 'ndjson', 'table']).default('json'))
  .action(async (opts) => {
    await query({
      odata: opts.odata,
      fields: opts.fields,
      pageAll: opts.pageAll,
      maxRows: opts.maxRows,
      output: opts.output,
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

// Error handling
program.hook('postAction', () => {
  // Clean exit after successful command
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
