import { AuthManager } from '../auth/auth-manager.js'
import { ValidationError } from '../errors.js'

export async function authSelect(profileName: string): Promise<void> {
  if (!profileName.trim()) {
    throw new ValidationError('Profile name must be a non-empty string')
  }
  const authManager = new AuthManager()
  authManager.selectProfile(profileName)
  console.log(`Active profile switched to '${profileName}'.`)
}
