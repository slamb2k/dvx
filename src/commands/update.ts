import { createClient } from '../client/create-client.js'
import { ValidationError } from '../errors.js'
import { validateGuid } from '../utils/validation.js'

interface UpdateOptions {
  json: string
  dryRun: boolean
}

export async function updateRecord(entityName: string, id: string, options: UpdateOptions): Promise<void> {
  validateGuid(id)
  const { client } = await createClient({ dryRun: options.dryRun })

  let data: Record<string, unknown>
  try {
    data = JSON.parse(options.json) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON payload')
  }

  await client.updateRecord(entityName, id, data)
  console.error('Record updated successfully')
}
