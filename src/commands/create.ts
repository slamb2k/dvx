import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'

interface CreateOptions {
  json: string
  dryRun: boolean
  callerObjectId?: string
}

export async function createRecord(entityName: string, options: CreateOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  const id = await client.createRecord(entityName, data)
  console.log(JSON.stringify({ id }))
}
