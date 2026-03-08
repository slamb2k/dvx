import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { ValidationError } from '../errors.js'
import { formatMutationResult, type OutputFormat } from '../utils/output.js'

interface ActionOptions {
  json: string
  entity?: string
  id?: string
  dryRun?: boolean
  callerObjectId?: string
  output?: OutputFormat
}

export async function actionCommand(actionName: string, options: ActionOptions): Promise<void> {
  if (!!options.entity !== !!options.id) {
    throw new ValidationError('--entity and --id must both be provided for bound actions')
  }

  const payload = parseJsonPayload(options.json)
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const result = await client.executeAction(actionName, payload, {
    entityName: options.entity,
    id: options.id,
  })

  const resultRecord = (result && typeof result === 'object' && !Array.isArray(result))
    ? result as Record<string, unknown>
    : { result: JSON.stringify(result) }

  formatMutationResult(resultRecord, { format: options.output ?? 'table' })
}
