import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { formatMutationResult, type OutputFormat } from '../utils/output.js'

interface CreateOptions {
  json: string
  dryRun: boolean
  callerObjectId?: string
  output?: OutputFormat
}

export async function createRecord(entityName: string, options: CreateOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  const id = await client.createRecord(entityName, data)
  formatMutationResult(null, { format: options.output ?? 'table', id })
}
