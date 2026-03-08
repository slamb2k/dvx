import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from '../client/dataverse-client.js'

interface SchemaOptions {
  output: 'json'
  noCache: boolean
}

export async function schema(entityName: string, options: SchemaOptions): Promise<void> {
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager)

  const entry = await client.getEntitySchema(entityName, options.noCache)

  console.log(JSON.stringify(entry, null, 2))
}
