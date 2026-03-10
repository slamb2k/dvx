import { createClient } from '../client/create-client.js'
import { renderTable } from '../utils/table.js'
import { createSpinner } from '../utils/cli.js'

interface SchemaOptions {
  output: 'json' | 'table'
  noCache: boolean
  refresh?: boolean
  refreshAll?: boolean
}

export async function schema(entityName: string, options: SchemaOptions): Promise<void> {
  const { client } = await createClient()

  if (options.refreshAll) {
    client.clearSchemaCache()
  } else if (options.refresh) {
    client.invalidateSchema(entityName)
  }

  const s = createSpinner()
  s.start(`Fetching schema for ${entityName}...`)
  let entry: Awaited<ReturnType<typeof client.getEntitySchema>>
  try {
    entry = await client.getEntitySchema(entityName, options.noCache)
  } catch (err) {
    s.error('Failed to fetch schema')
    throw err
  }
  s.stop(`Schema loaded: ${entry.attributes.length} attributes`)

  if (options.output === 'table') {
    const rows = entry.attributes.map((a) => [
      a.logicalName,
      a.displayName,
      a.attributeType,
      a.requiredLevel === 'ApplicationRequired' || a.requiredLevel === 'SystemRequired' ? 'Yes' : 'No',
    ])
    console.log(renderTable(rows, ['LogicalName', 'DisplayName', 'Type', 'Required']))
  } else {
    console.log(JSON.stringify(entry, null, 2))
  }
}
