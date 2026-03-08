import { AuthManager } from '../auth/auth-manager.js'
import { createClient } from '../client/create-client.js'
import * as readline from 'node:readline/promises'

const MANUAL_INSTRUCTIONS = `
Manual Setup Instructions:
1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. Click "New registration", set name to "dvx", type "Single tenant"
3. Go to the new app → Certificates & secrets → New client secret
4. Copy the Application (client) ID and the secret value
5. In Dataverse admin, create an Application User with the client ID
6. Assign the "System Administrator" or relevant security role
7. Run: dvx auth create --service-principal
`

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return (await rl.question(question)).trim()
}

export async function init(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })

  try {
    console.error('dvx init — Dataverse CLI setup wizard\n')

    const tenantId = await prompt(rl, 'Entra tenant ID: ')
    const environmentUrl = await prompt(rl, 'Dataverse environment URL (e.g. https://org.crm.dynamics.com): ')

    console.error(MANUAL_INSTRUCTIONS)
    const clientId = await prompt(rl, 'Enter client ID from manual setup: ')
    const clientSecret = await prompt(rl, 'Enter client secret from manual setup: ')

    // Create auth profile
    const manager = new AuthManager()
    manager.createProfile({
      name: 'default',
      type: 'service-principal',
      environmentUrl,
      tenantId,
      clientId,
      clientSecret,
    })

    // Validate connection
    console.error('\nValidating connection...')
    const { client } = await createClient()
    const entities = await client.listEntities()
    console.error(`✓ Connected — found ${entities.length} entities`)
    console.log(JSON.stringify({ ok: true, profile: 'default', entityCount: entities.length }))

  } finally {
    rl.close()
  }
}
