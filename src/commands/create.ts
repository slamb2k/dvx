import { createClient } from '../client/create-client.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { validateEntityName } from '../utils/validation.js'
import { formatMutationResult } from '../utils/output.js'
import { BaseMutationOptions } from './types.js'
import { createSpinner, logMutationSuccess } from '../utils/cli.js'

interface CreateOptions extends BaseMutationOptions {
  json: string
}

export async function createRecord(entityName: string, options: CreateOptions): Promise<void> {
  validateEntityName(entityName)
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  const s = createSpinner()
  s.start(`Creating ${entityName}...`)
  let id: string
  try {
    id = await client.createRecord(entityName, data)
  } catch (err) {
    s.error('Create failed')
    throw err
  }
  s.stop(`Created ${entityName}`)
  logMutationSuccess(`Created ${entityName} ${id}`)
  formatMutationResult(null, { format: options.output ?? 'table', id })
}
