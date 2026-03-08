import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { formatMutationResult } from '../utils/output.js'
import { BaseMutationOptions } from './types.js'

interface CreateOptions extends BaseMutationOptions {
  json: string
}

export async function createRecord(entityName: string, options: CreateOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  const id = await client.createRecord(entityName, data)
  formatMutationResult(null, { format: options.output ?? 'table', id })
}
