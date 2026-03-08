import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { validateGuid } from '../utils/validation.js'

interface UpdateOptions {
  json: string
  dryRun: boolean
}

export async function updateRecord(entityName: string, id: string, options: UpdateOptions): Promise<void> {
  validateGuid(id)
  const { client } = await createClient({ dryRun: options.dryRun })

  const data = parseJsonPayload(options.json)

  await client.updateRecord(entityName, id, data)
  console.error('Record updated successfully')
}
