import { createClient } from '../client/create-client.js'
import { ValidationError } from '../errors.js'
import { parseJsonPayload } from '../utils/parse-json.js'
import { formatMutationResult } from '../utils/output.js'
import { BaseMutationOptions } from './types.js'
import { createSpinner, logMutationSuccess } from '../utils/cli.js'

interface UpsertOptions extends BaseMutationOptions {
  matchField: string
  json: string
}

export async function upsertRecord(entityName: string, options: UpsertOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const data = parseJsonPayload(options.json)

  const matchValue = data[options.matchField]
  if (matchValue === undefined) {
    throw new ValidationError(`Match field '${options.matchField}' not found in JSON payload`)
  }

  const schema = await client.getEntitySchema(entityName)

  const attr = schema.attributes.find((a) => a.logicalName === options.matchField)
  if (!attr) {
    throw new ValidationError(`Unknown field: ${options.matchField}`)
  }

  const escapedValue = typeof matchValue === 'string'
    ? `'${matchValue.replace(/'/g, "''")}'`
    : String(matchValue)
  const odata = `$filter=${options.matchField} eq ${escapedValue}&$select=${schema.primaryIdAttribute}`

  const s = createSpinner()
  s.start(`Upserting ${entityName}...`)
  try {
    const records = await client.query(schema.entitySetName, odata, { pageAll: false, maxRows: 1 })

    if (records.length > 0) {
      const existingId = String(records[0]![schema.primaryIdAttribute])
      await client.updateRecord(entityName, existingId, data)
      s.stop(`Upserted ${entityName}`)
      logMutationSuccess(`Upserted ${entityName} ${existingId} (updated)`)
      formatMutationResult({ action: 'updated', id: existingId }, { format: options.output ?? 'table', id: existingId })
    } else {
      const id = await client.createRecord(entityName, data)
      s.stop(`Upserted ${entityName}`)
      logMutationSuccess(`Upserted ${entityName} ${id} (created)`)
      formatMutationResult({ action: 'created', id }, { format: options.output ?? 'table', id })
    }
  } catch (err) {
    s.error('Upsert failed')
    throw err
  }
}
