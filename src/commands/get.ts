import { createClient } from '../client/create-client.js'
import { validateEntityName, validateGuid } from '../utils/validation.js'
import { renderTable } from '../utils/table.js'
import { createSpinner } from '../utils/cli.js'

interface GetOptions {
  fields?: string
  output: 'json' | 'table'
}

export async function get(entityName: string, id: string, options: GetOptions): Promise<void> {
  validateEntityName(entityName)
  const validatedId = validateGuid(id)
  const { client } = await createClient()

  const fields = options.fields?.split(',').map((f) => f.trim()).filter((f) => f.length > 0)

  const s = createSpinner()
  s.start(`Fetching ${entityName} ${validatedId}...`)
  let record: Awaited<ReturnType<typeof client.getRecord>>
  try {
    record = await client.getRecord(entityName, validatedId, fields)
  } catch (err) {
    s.error('Failed to fetch record')
    throw err
  }
  s.stop('Record loaded')

  if (options.output === 'json') {
    console.log(JSON.stringify(record, null, 2))
  } else {
    const entries = Object.entries(record).filter(([k]) => !k.startsWith('@'))
    if (entries.length === 0) {
      console.log('No fields returned.')
      return
    }
    const rows = entries.map(([key, value]) => [key, String(value ?? '')])
    console.log(renderTable(rows, ['Field', 'Value']))
  }
}
