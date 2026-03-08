import { AuthManager } from '../auth/auth-manager.js'
import { AuthProfile } from '../auth/auth-profile.js'
import { validateUrl } from '../utils/validation.js'

interface AuthCreateOptions {
  name: string
  environmentUrl: string
  tenantId: string
  clientId: string
  clientSecret?: string
}

export async function authCreate(options: AuthCreateOptions): Promise<void> {
  const envUrl = validateUrl(options.environmentUrl)

  const profile: AuthProfile = {
    name: options.name,
    type: 'service-principal',
    environmentUrl: envUrl,
    tenantId: options.tenantId,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
  }

  const authManager = new AuthManager()
  authManager.createProfile(profile)

  // Validate connection by acquiring a token
  try {
    await authManager.getToken(profile)
    console.log(`Profile '${options.name}' created and validated successfully.`)
  } catch (error) {
    console.error(`Profile '${options.name}' created but token acquisition failed.`)
    console.error(`Check your credentials and try again.`)
    throw error
  }
}
