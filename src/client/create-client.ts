import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from './dataverse-client.js'

export async function createClient(opts?: { dryRun?: boolean }): Promise<{ authManager: AuthManager; client: DataverseClient }> {
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager, undefined, opts)
  return { authManager, client }
}
