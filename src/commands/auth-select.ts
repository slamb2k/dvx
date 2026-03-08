import { createClient } from '../client/create-client.js'
import { ValidationError } from '../errors.js'

export async function authSelect(profileName: string): Promise<void> {
  if (!profileName.trim()) {
    throw new ValidationError('Profile name must be a non-empty string')
  }
  const { authManager } = await createClient()
  authManager.selectProfile(profileName)
  console.log(`Active profile switched to '${profileName}'.`)
}
