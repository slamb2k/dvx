import { AuthProfile } from '../auth/auth-profile.js'
import { AuthManager } from '../auth/auth-manager.js'
import { validateUrl } from '../utils/validation.js'

interface AuthLoginOptions {
  name: string
  environmentUrl: string
  tenantId: string
  clientId: string
}

export async function authLogin(options: AuthLoginOptions): Promise<void> {
  const envUrl = validateUrl(options.environmentUrl)

  const profile: AuthProfile = {
    name: options.name,
    type: 'delegated',
    environmentUrl: envUrl,
    tenantId: options.tenantId,
    clientId: options.clientId,
  }

  const manager = new AuthManager()
  await manager.createProfile(profile)

  await manager.getToken(options.name)
  console.log(JSON.stringify({ profile: options.name, status: 'logged_in' }))
}
