import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from './dataverse-client.js'

export async function createClient(): Promise<{ authManager: AuthManager; client: DataverseClient }> {
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager)
  return { authManager, client }
}
