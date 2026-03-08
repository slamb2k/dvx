import { createClient } from '../client/create-client.js'
import { ValidationError } from '../errors.js'

interface UpsertOptions {
  matchField: string
  json: string
  dryRun: boolean
}

export async function upsertRecord(entityName: string, options: UpsertOptions): Promise<void> {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(options.json) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON payload')
  }

  const matchValue = data[options.matchField]
  if (matchValue === undefined) {
    throw new ValidationError(`Match field '${options.matchField}' not found in JSON payload`)
  }

  if (options.dryRun) {
    console.error(`[DRY RUN] Upsert ${entityName} matching on ${options.matchField}=${String(matchValue)}`)
    console.error(`[DRY RUN] Body: ${JSON.stringify(data)}`)
    return
  }

  const { client } = await createClient({ dryRun: options.dryRun })

  const schema = await client.getEntitySchema(entityName)
  const escapedValue = typeof matchValue === 'string'
    ? `'${matchValue.replace(/'/g, "''")}'`
    : String(matchValue)
  const odata = `$filter=${options.matchField} eq ${escapedValue}&$select=${schema.primaryIdAttribute}`

  const records = await client.query(schema.entitySetName, odata, { pageAll: false, maxRows: 1 })

  if (records.length > 0) {
    const existingId = String(records[0]![schema.primaryIdAttribute])
    await client.updateRecord(entityName, existingId, data)
    console.log(JSON.stringify({ action: 'updated', id: existingId }))
  } else {
    const id = await client.createRecord(entityName, data)
    console.log(JSON.stringify({ action: 'created', id }))
  }
}
