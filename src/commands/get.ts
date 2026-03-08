import { createClient } from '../client/create-client.js'
import { validateGuid } from '../utils/validation.js'
import { renderTable } from '../utils/table.js'

interface GetOptions {
  fields?: string
  output: 'json' | 'table'
}

export async function get(entityName: string, id: string, options: GetOptions): Promise<void> {
  const validatedId = validateGuid(id)
  const { client } = await createClient()

  const fields = options.fields?.split(',').map((f) => f.trim()).filter((f) => f.length > 0)
  const record = await client.getRecord(entityName, validatedId, fields)

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
