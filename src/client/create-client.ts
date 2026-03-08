import * as path from 'node:path'
import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from './dataverse-client.js'
import { SqliteSchemaCache } from '../schema/sqlite-schema-cache.js'

export async function createClient(opts?: { dryRun?: boolean; callerObjectId?: string }): Promise<{ authManager: AuthManager; client: DataverseClient }> {
  const authManager = new AuthManager()
  const dbPath = process.env['DVX_SCHEMA_CACHE_PATH'] ?? path.join(process.cwd(), '.dvx', 'cache.db')
  const ttlMs = Number(process.env['DVX_SCHEMA_CACHE_TTL_MS']) || 300_000
  const schemaCache = new SqliteSchemaCache(dbPath, ttlMs)
  const client = new DataverseClient(authManager, schemaCache, opts)
  return { authManager, client }
}
