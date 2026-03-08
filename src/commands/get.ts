import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from '../client/dataverse-client.js'

interface GetOptions {
  fields?: string
}

export async function get(entityName: string, id: string, options: GetOptions): Promise<void> {
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager)

  const fields = options.fields?.split(',').map((f) => f.trim())
  const record = await client.getRecord(entityName, id, fields)

  console.log(JSON.stringify(record, null, 2))
}
