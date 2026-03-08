import { createClient } from '../client/create-client.js'
import { ValidationError } from '../errors.js'

interface CreateOptions {
  json: string
  dryRun: boolean
}

export async function createRecord(entityName: string, options: CreateOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun })

  let data: Record<string, unknown>
  try {
    data = JSON.parse(options.json) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON payload')
  }

  const id = await client.createRecord(entityName, data)
  console.log(JSON.stringify({ id }))
}
