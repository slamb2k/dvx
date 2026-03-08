import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from '../client/dataverse-client.js'
import { validateGuid } from '../utils/validation.js'

interface GetOptions {
  fields?: string
  output: 'json' | 'table'
}

export async function get(entityName: string, id: string, options: GetOptions): Promise<void> {
  const validatedId = validateGuid(id)
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager)

  const fields = options.fields?.split(',').map((f) => f.trim()).filter((f) => f.length > 0)
  const record = await client.getRecord(entityName, validatedId, fields)

  if (options.output === 'json') {
    console.log(JSON.stringify(record, null, 2))
  } else {
    const entries = Object.entries(record).filter(([k]) => !k.startsWith('@'))
    if (entries.length === 0) {
      console.log('No fields returned.')
      return
    }
    const maxField = Math.max(...entries.map(([k]) => k.length), 5)
    console.log('Field'.padEnd(maxField + 2) + 'Value')
    console.log('-'.repeat(maxField + 40))
    for (const [key, value] of entries) {
      console.log(key.padEnd(maxField + 2) + String(value ?? ''))
    }
  }
}
