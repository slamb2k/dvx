import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { validateGuid } from '../utils/validation.js'
import { formatMutationResult, type OutputFormat } from '../utils/output.js'

interface UpdateOptions {
  json: string
  dryRun: boolean
  callerObjectId?: string
  output?: OutputFormat
}

export async function updateRecord(entityName: string, id: string, options: UpdateOptions): Promise<void> {
  validateGuid(id)
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  await client.updateRecord(entityName, id, data)
  formatMutationResult(null, { format: options.output ?? 'table' })
}
