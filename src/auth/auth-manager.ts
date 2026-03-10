import * as fs from 'node:fs'
import * as path from 'node:path'
import { ConfidentialClientApplication, PublicClientApplication } from '@azure/msal-node'
import {
  AuthProfileNotFoundError,
  AuthProfileExistsError,
  TokenAcquisitionError,
  PkceFlowError,
} from '../errors.js'
import { AuthConfig, AuthConfigSchema, AuthProfile } from './auth-profile.js'
import { MsalCachePlugin } from './msal-cache-plugin.js'
import { openBrowser } from '../utils/browser.js'

const CONFIG_DIR = '.dvx'
const CONFIG_FILE = 'config.json'

export class AuthManager {
  private configPath: string
  private basePath: string
  private config: AuthConfig

  constructor(basePath?: string) {
    this.basePath = basePath ?? process.cwd()
    this.configPath = path.join(this.basePath, CONFIG_DIR, CONFIG_FILE)
    this.config = this.loadConfig()
  }

  private loadConfig(): AuthConfig {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8')
      return AuthConfigSchema.parse(JSON.parse(raw))
    } catch {
      return { profiles: {} }
    }
  }

  private saveConfig(): void {
    const dir = path.dirname(this.configPath)
    fs.mkdirSync(dir, { recursive: true })

    // Save config without secrets
    const safeConfig: AuthConfig = {
      activeProfile: this.config.activeProfile,
      profiles: {},
    }
    for (const [name, profile] of Object.entries(this.config.profiles)) {
      const { clientSecret: _secret, ...rest } = profile
      safeConfig.profiles[name] = rest as AuthProfile
    }

    fs.writeFileSync(this.configPath, JSON.stringify(safeConfig, null, 2))
  }

  createProfile(profile: AuthProfile): void {
    if (this.config.profiles[profile.name]) {
      throw new AuthProfileExistsError(profile.name)
    }
    this.config.profiles[profile.name] = profile
    if (!this.config.activeProfile) {
      this.config.activeProfile = profile.name
    }
    this.saveConfig()
  }

  getActiveProfile(): AuthProfile {
    const name = this.config.activeProfile
    if (!name || !this.config.profiles[name]) {
      throw new AuthProfileNotFoundError(name ?? 'default')
    }
    return this.config.profiles[name]
  }

  listProfiles(): Array<{ name: string; active: boolean; profile: AuthProfile }> {
    return Object.entries(this.config.profiles).map(([name, profile]) => ({
      name,
      active: name === this.config.activeProfile,
      profile,
    }))
  }

  selectProfile(name: string): void {
    if (!this.config.profiles[name]) {
      throw new AuthProfileNotFoundError(name)
    }
    this.config.activeProfile = name
    this.saveConfig()
  }

  deleteProfile(name: string): void {
    if (!this.config.profiles[name]) {
      throw new AuthProfileNotFoundError(name)
    }
    delete this.config.profiles[name]
    if (this.config.activeProfile === name) {
      const remaining = Object.keys(this.config.profiles)
      this.config.activeProfile = remaining.length > 0 ? remaining[0] : undefined
    }
    this.saveConfig()
  }

  deleteAllProfiles(): void {
    this.config.profiles = {}
    this.config.activeProfile = undefined
    this.saveConfig()
  }

  private saveProfile(profile: AuthProfile): void {
    this.config.profiles[profile.name] = profile
    this.saveConfig()
  }

  private async getTokenDelegated(profile: AuthProfile): Promise<string> {
    const cacheFilePath = path.join(this.basePath, '.dvx', 'msal-cache.json')
    const pca = new PublicClientApplication({
      auth: {
        clientId: profile.clientId,
        authority: `https://login.microsoftonline.com/${profile.tenantId}`,
      },
      cache: {
        cachePlugin: new MsalCachePlugin(cacheFilePath),
      },
    })

    const scopes = [`${profile.environmentUrl}/user_impersonation`]
    const accounts = await pca.getAllAccounts()

    if (accounts.length > 0 && accounts[0]) {
      try {
        const result = await pca.acquireTokenSilent({
          account: accounts[0],
          scopes,
        })
        if (result?.accessToken) return result.accessToken
      } catch {
        // Fall through to interactive
      }
    }

    const result = await pca.acquireTokenInteractive({
      scopes,
      openBrowser: async (url) => {
        openBrowser(url)
      },
      successTemplate: '<h1>Authentication complete. You may close this tab.</h1>',
      errorTemplate: '<h1>Authentication failed: {error}</h1>',
    })

    if (!result?.accessToken) throw new PkceFlowError('No access token returned from interactive login')

    if (result.account?.homeAccountId) {
      profile.homeAccountId = result.account.homeAccountId
      // Note: saveProfile does a full config read-modify-write; safe for single-process CLI use
      this.saveProfile(profile)
    }

    return result.accessToken
  }

  async getToken(profileOrName?: AuthProfile | string): Promise<string> {
    let p: AuthProfile
    if (typeof profileOrName === 'string') {
      if (!this.config.profiles[profileOrName]) {
        throw new AuthProfileNotFoundError(profileOrName)
      }
      p = this.config.profiles[profileOrName]
    } else {
      p = profileOrName ?? this.getActiveProfile()
    }

    if (p.type === 'delegated') {
      return this.getTokenDelegated(p)
    }

    const clientSecret = p.clientSecret ?? process.env['DATAVERSE_CLIENT_SECRET']
    if (!clientSecret) {
      throw new TokenAcquisitionError(
        'Client secret not found. Set DATAVERSE_CLIENT_SECRET environment variable.',
      )
    }

    const app = new ConfidentialClientApplication({
      auth: {
        clientId: p.clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${p.tenantId}`,
      },
    })

    const result = await app.acquireTokenByClientCredential({
      scopes: [`${p.environmentUrl}/.default`],
    })

    if (!result?.accessToken) {
      throw new TokenAcquisitionError('No access token returned from Entra ID')
    }

    return result.accessToken
  }
}
