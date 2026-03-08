import * as fs from 'node:fs'
import * as path from 'node:path'
import { ConfidentialClientApplication } from '@azure/msal-node'
import {
  AuthProfileNotFoundError,
  AuthProfileExistsError,
  TokenAcquisitionError,
} from '../errors.js'
import { AuthConfig, AuthConfigSchema, AuthProfile } from './auth-profile.js'

const CONFIG_DIR = '.dvx'
const CONFIG_FILE = 'config.json'

export class AuthManager {
  private configPath: string
  private config: AuthConfig

  constructor(basePath?: string) {
    const base = basePath ?? process.cwd()
    this.configPath = path.join(base, CONFIG_DIR, CONFIG_FILE)
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

  async getToken(profile?: AuthProfile): Promise<string> {
    const p = profile ?? this.getActiveProfile()

    if (p.type !== 'service-principal') {
      throw new TokenAcquisitionError('Only service-principal auth is supported in Phase 1')
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
