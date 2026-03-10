import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { ValidationError } from '../errors.js'
import { formatMutationResult } from '../utils/output.js'
import { BaseMutationOptions } from './types.js'
import { createSpinner, logMutationSuccess } from '../utils/cli.js'

interface ActionOptions extends BaseMutationOptions {
  json: string
  entity?: string
  id?: string
}

export async function actionCommand(actionName: string, options: ActionOptions): Promise<void> {
  if (!!options.entity !== !!options.id) {
    throw new ValidationError('--entity and --id must both be provided for bound actions')
  }

  const payload = parseJsonPayload(options.json)
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const s = createSpinner()
  s.start(`Executing ${actionName}...`)
  let result: unknown
  try {
    result = await client.executeAction(actionName, payload, {
      entityName: options.entity,
      id: options.id,
    })
  } catch (err) {
    s.error('Action failed')
    throw err
  }
  s.stop('Action complete')
  logMutationSuccess(`Executed ${actionName}`)

  const resultRecord = (result && typeof result === 'object' && !Array.isArray(result))
    ? result as Record<string, unknown>
    : { result: JSON.stringify(result) }

  formatMutationResult(resultRecord, { format: options.output ?? 'table' })
}
