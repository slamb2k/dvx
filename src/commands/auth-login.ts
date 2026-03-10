import { PublicClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import * as clack from '@clack/prompts'
import { AuthProfile } from '../auth/auth-profile.js'
import { AuthManager } from '../auth/auth-manager.js'
import { MsalCachePlugin } from '../auth/msal-cache-plugin.js'
import { createClient } from '../client/create-client.js'
import { openBrowser } from '../utils/browser.js'
import { validateUrl } from '../utils/validation.js'
import * as readline from 'node:readline/promises'
import * as path from 'node:path'

// Well-known dvx bootstrapper app — multi-tenant, delegated Application.ReadWrite.All + CRM
const DVX_BOOTSTRAPPER_CLIENT_ID = '73f809fb-5469-4956-85f9-e0141af82d90'

const MANUAL_INSTRUCTIONS = `
Manual Setup Instructions:
1. Go to https://portal.azure.com → Azure Active Directory → App registrations
2. Click "New registration", set name to "dvx", type "Single tenant"
3. Go to the new app → Certificates & secrets → New client secret
4. Copy the Application (client) ID and the secret value
5. In Dataverse admin, create an Application User with the client ID
6. Assign the "System Administrator" or relevant security role
`

export interface AuthLoginOptions {
  name: string
  url?: string | undefined
  tenantId?: string | undefined
  clientId?: string | undefined
  clientSecret?: string | undefined
  servicePrincipal?: boolean | undefined
}

interface BootstrapSession {
  pca: PublicClientApplication
  tenantId: string
}

async function rlPrompt(rl: readline.Interface, question: string): Promise<string> {
  return (await rl.question(question)).trim()
}

async function bootstrapSignIn(tenantId: string | undefined): Promise<BootstrapSession> {
  const authority = tenantId
    ? `https://login.microsoftonline.com/${tenantId}`
    : 'https://login.microsoftonline.com/organizations'

  const cacheFilePath = path.join(process.cwd(), '.dvx', 'msal-cache-bootstrapper.json')
  const pca = new PublicClientApplication({
    auth: {
      clientId: DVX_BOOTSTRAPPER_CLIENT_ID,
      authority,
    },
    cache: {
      cachePlugin: new MsalCachePlugin(cacheFilePath),
    },
  })

  // Try silent first, then interactive
  const scopes = ['https://globaldisco.crm.dynamics.com//user_impersonation']
  const accounts = await pca.getAllAccounts()
  let discoveredTenantId = tenantId

  if (accounts.length > 0 && accounts[0]) {
    try {
      const result = await pca.acquireTokenSilent({ account: accounts[0], scopes })
      if (result?.accessToken && result.account?.tenantId) {
        return { pca, tenantId: discoveredTenantId ?? result.account.tenantId }
      }
    } catch {
      // Fall through to interactive
    }
  }

  const result = await pca.acquireTokenInteractive({
    scopes,
    openBrowser: async (url) => { openBrowser(url) },
    successTemplate: '<h1>Authentication complete. You may close this tab.</h1>',
    errorTemplate: '<h1>Authentication failed: {error}</h1>',
  })

  if (!result?.accessToken) {
    throw new Error('Failed to acquire token during sign-in')
  }

  discoveredTenantId = discoveredTenantId ?? result.account?.tenantId
  if (!discoveredTenantId) {
    throw new Error('Could not determine tenant ID from sign-in. Pass --tenant-id explicitly.')
  }

  return { pca, tenantId: discoveredTenantId }
}

interface DiscoveredEnvironment {
  url: string
  friendlyName: string
  uniqueName: string
  state: string
  version: string
}

async function discoverEnvironments(pca: PublicClientApplication): Promise<DiscoveredEnvironment[]> {
  const scopes = ['https://globaldisco.crm.dynamics.com//user_impersonation']
  const accounts = await pca.getAllAccounts()

  let accessToken: string | undefined

  if (accounts.length > 0 && accounts[0]) {
    try {
      const result = await pca.acquireTokenSilent({ account: accounts[0], scopes })
      accessToken = result?.accessToken
    } catch {
      // Can't get token silently
    }
  }

  if (!accessToken) {
    const result = await pca.acquireTokenInteractive({
      scopes,
      openBrowser: async (url) => { openBrowser(url) },
      successTemplate: '<h1>Authentication complete. You may close this tab.</h1>',
      errorTemplate: '<h1>Authentication failed: {error}</h1>',
    })
    accessToken = result?.accessToken
  }

  if (!accessToken) {
    throw new Error('Failed to acquire discovery token')
  }

  const response = await fetch('https://globaldisco.crm.dynamics.com/api/discovery/v2.0/Instances', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Discovery API returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json() as { value: Array<{ Url: string; FriendlyName: string; UniqueName: string; State: number; Version: string }> }

  return data.value
    .filter((env) => env.State === 0) // Only enabled environments
    .map((env) => ({
      url: env.Url,
      friendlyName: env.FriendlyName,
      uniqueName: env.UniqueName,
      state: env.State === 0 ? 'Enabled' : 'Disabled',
      version: env.Version,
    }))
}

async function selectEnvironment(environments: DiscoveredEnvironment[]): Promise<string> {
  const options: Array<{ value: string; label: string; hint?: string }> = environments.map((env) => ({
    value: env.url,
    label: env.friendlyName || env.uniqueName,
    hint: env.url,
  }))

  options.push({
    value: '__manual__',
    label: 'Enter URL manually',
    hint: 'Specify a Dataverse environment URL',
  })

  const selected = await clack.select({
    message: 'Select a Dataverse environment',
    options,
  })

  if (clack.isCancel(selected)) {
    clack.cancel('Login cancelled.')
    process.exit(0)
  }

  if (selected === '__manual__') {
    const url = await clack.text({
      message: 'Dataverse environment URL',
      placeholder: 'https://org.crm.dynamics.com',
      validate: (value) => {
        if (!value) return 'Please enter a valid URL'
        try {
          new URL(value)
        } catch {
          return 'Please enter a valid URL'
        }
      },
    })

    if (clack.isCancel(url)) {
      clack.cancel('Login cancelled.')
      process.exit(0)
    }

    return url as string
  }

  return selected as string
}

async function acquireGraphToken(pca: PublicClientApplication): Promise<string> {
  const scopes = ['https://graph.microsoft.com/Application.ReadWrite.All']
  const accounts = await pca.getAllAccounts()

  if (accounts.length > 0 && accounts[0]) {
    try {
      const result = await pca.acquireTokenSilent({ account: accounts[0], scopes })
      if (result?.accessToken) return result.accessToken
    } catch {
      // Fall through to interactive
    }
  }

  const result = await pca.acquireTokenInteractive({
    scopes,
    openBrowser: async (url) => { openBrowser(url) },
    successTemplate: '<h1>Authentication complete. You may close this tab.</h1>',
    errorTemplate: '<h1>Authentication failed: {error}</h1>',
  })

  if (!result?.accessToken) {
    throw new Error('Failed to acquire Graph API token')
  }

  return result.accessToken
}

async function provisionViaGraph(pca: PublicClientApplication): Promise<string> {
  const accessToken = await acquireGraphToken(pca)

  const graphClient = Client.init({
    authProvider: (done) => { done(null, accessToken) },
  })

  // 1. Create app registration with redirect URI for PKCE
  clack.log.step('Creating app registration "dvx-service"...')
  const app = await graphClient.api('/applications').post({
    displayName: 'dvx-service',
    signInAudience: 'AzureADMyOrg',
    publicClient: {
      redirectUris: ['http://localhost'],
    },
    requiredResourceAccess: [
      {
        resourceAppId: '00000007-0000-0000-c000-000000000000',
        resourceAccess: [
          { id: '78ce3f0f-a1ce-49c2-8cde-64b5c0896db4', type: 'Scope' },
        ],
      },
    ],
  }) as { appId: string; id: string }

  clack.log.success(`App created: ${app.appId}`)

  // 2. Create service principal
  clack.log.step('Creating service principal...')
  await graphClient.api('/servicePrincipals').post({
    appId: app.appId,
  })
  clack.log.success('Service principal created')

  // 3. Grant admin consent for Dynamics CRM user_impersonation
  clack.log.step('Granting admin consent for Dataverse access...')
  try {
    const crmSp = await graphClient.api('/servicePrincipals')
      .filter("appId eq '00000007-0000-0000-c000-000000000000'")
      .select('id')
      .get() as { value: Array<{ id: string }> }

    const dvxSp = await graphClient.api('/servicePrincipals')
      .filter(`appId eq '${app.appId}'`)
      .select('id')
      .get() as { value: Array<{ id: string }> }

    if (crmSp.value[0] && dvxSp.value[0]) {
      await graphClient.api('/oauth2PermissionGrants').post({
        clientId: dvxSp.value[0].id,
        consentType: 'AllPrincipals',
        resourceId: crmSp.value[0].id,
        scope: 'user_impersonation',
      })
      clack.log.success('Admin consent granted')
    }
  } catch {
    clack.log.warn('Could not auto-grant consent (may require Global Admin). Users will be prompted on first login.')
  }

  return app.appId
}

export async function authLogin(options: AuthLoginOptions): Promise<void> {
  if (options.servicePrincipal) {
    if (!options.url) {
      throw new Error('Environment URL required for service principal auth. Pass --url.')
    }
    const envUrl = validateUrl(options.url)
    const clientSecret = options.clientSecret ?? process.env['DATAVERSE_CLIENT_SECRET']
    if (!clientSecret) {
      throw new Error('Client secret required. Pass --client-secret or set DATAVERSE_CLIENT_SECRET.')
    }
    if (!options.clientId) {
      throw new Error('Client ID required for service principal auth. Pass --client-id.')
    }
    if (!options.tenantId) {
      throw new Error('Tenant ID required for service principal auth. Pass --tenant-id.')
    }

    const profile: AuthProfile = {
      name: options.name,
      type: 'service-principal',
      environmentUrl: envUrl,
      tenantId: options.tenantId,
      clientId: options.clientId,
      clientSecret,
    }

    const manager = new AuthManager()
    manager.createProfile(profile)

    process.env['DATAVERSE_CLIENT_SECRET'] = clientSecret

    console.error('Validating connection...')
    const { client } = await createClient()
    const entityList = await client.listEntities()
    console.error(`✓ Connected — found ${entityList.length} entities`)
    console.log(JSON.stringify({ profile: options.name, type: 'service-principal', status: 'logged_in', entityCount: entityList.length }))
    return
  }

  // ── Delegated flow ──────────────────────────────────────────

  clack.intro('dvx auth login')

  let envUrl = options.url ? validateUrl(options.url) : undefined
  let tenantId = options.tenantId
  let clientId = options.clientId
  let session: BootstrapSession | undefined

  // Step 1: If no URL, sign in and discover environments
  if (!envUrl) {
    const s = clack.spinner()
    s.start('Signing in to discover environments...')

    try {
      session = await bootstrapSignIn(tenantId)
      tenantId = session.tenantId
      s.stop('Signed in')
    } catch (err) {
      s.stop('Sign-in failed')
      const message = err instanceof Error ? err.message : String(err)
      clack.log.warn(`Could not sign in for discovery: ${message}`)

      const url = await clack.text({
        message: 'Dataverse environment URL',
        placeholder: 'https://org.crm.dynamics.com',
        validate: (value) => {
          if (!value) return 'Please enter a valid URL'
          try {
            new URL(value)
          } catch {
            return 'Please enter a valid URL'
          }
        },
      })

      if (clack.isCancel(url)) {
        clack.cancel('Login cancelled.')
        process.exit(0)
      }

      envUrl = validateUrl(url as string)
    }

    if (!envUrl && session) {
      const s2 = clack.spinner()
      s2.start('Discovering environments...')

      try {
        const environments = await discoverEnvironments(session.pca)
        s2.stop(`Found ${environments.length} environment${environments.length === 1 ? '' : 's'}`)

        if (environments.length > 0) {
          envUrl = validateUrl(await selectEnvironment(environments))
        } else {
          clack.log.warn('No Dataverse environments found for this account.')
          const url = await clack.text({
            message: 'Dataverse environment URL',
            placeholder: 'https://org.crm.dynamics.com',
            validate: (value) => {
              if (!value) return 'Please enter a valid URL'
              try {
                new URL(value)
              } catch {
                return 'Please enter a valid URL'
              }
            },
          })

          if (clack.isCancel(url)) {
            clack.cancel('Login cancelled.')
            process.exit(0)
          }

          envUrl = validateUrl(url as string)
        }
      } catch (err) {
        s2.stop('Discovery failed')
        const message = err instanceof Error ? err.message : String(err)
        clack.log.warn(`Discovery failed: ${message}`)

        const url = await clack.text({
          message: 'Dataverse environment URL',
          placeholder: 'https://org.crm.dynamics.com',
          validate: (value) => {
            if (!value) return 'Please enter a valid URL'
            try {
              new URL(value)
            } catch {
              return 'Please enter a valid URL'
            }
          },
        })

        if (clack.isCancel(url)) {
          clack.cancel('Login cancelled.')
          process.exit(0)
        }

        envUrl = validateUrl(url as string)
      }
    }
  }

  if (!envUrl) {
    throw new Error('No environment URL determined. Pass --url explicitly.')
  }

  // Step 2: Auto-provision app registration if no client-id
  if (!clientId) {
    try {
      if (!session) {
        const s = clack.spinner()
        s.start('Signing in for app registration...')
        session = await bootstrapSignIn(tenantId)
        tenantId = session.tenantId
        s.stop('Signed in')
      }

      clientId = await provisionViaGraph(session.pca)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      clack.log.warn(`Automated app registration failed: ${message}`)
      clack.log.message(MANUAL_INSTRUCTIONS)

      const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
      try {
        clientId = await rlPrompt(rl, 'Enter client ID from app registration: ')
        if (!tenantId) {
          tenantId = await rlPrompt(rl, 'Enter Entra tenant ID: ')
        }
      } finally {
        rl.close()
      }
    }
  }

  if (!tenantId) {
    throw new Error('Could not determine tenant ID. Pass --tenant-id explicitly.')
  }

  // Step 3: Create profile and sign in to Dataverse
  const profile: AuthProfile = {
    name: options.name,
    type: 'delegated',
    environmentUrl: envUrl,
    tenantId,
    clientId,
  }

  const manager = new AuthManager()
  manager.createProfile(profile)

  const s = clack.spinner()
  s.start('Signing in to Dataverse...')
  await manager.getToken(options.name)
  s.stop('Signed in')

  clack.outro(`Logged in as '${options.name}' → ${envUrl}`)
  console.log(JSON.stringify({ profile: options.name, type: 'delegated', status: 'logged_in' }))
}

export async function authLogout(options: { all?: boolean | undefined }): Promise<void> {
  const manager = new AuthManager()

  if (options.all) {
    manager.deleteAllProfiles()
    console.log('All auth profiles removed.')
    return
  }

  const active = manager.getActiveProfile()
  manager.deleteProfile(active.name)
  console.log(`Profile '${active.name}' removed.`)
}
