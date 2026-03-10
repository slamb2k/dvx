import { createClient } from '../client/create-client.js'
import { renderTable } from '../utils/table.js'
import { createSpinner } from '../utils/cli.js'

interface EntitiesOptions {
  output: 'json' | 'table' | 'ndjson'
}

export async function entities(options: EntitiesOptions): Promise<void> {
  const { client } = await createClient()

  const s = createSpinner()
  s.start('Fetching entities...')
  let entityList: Awaited<ReturnType<typeof client.listEntities>>
  try {
    entityList = await client.listEntities()
  } catch (err) {
    s.error('Failed to fetch entities')
    throw err
  }
  s.stop(`Found ${entityList.length} entities`)

  if (options.output === 'json') {
    console.log(JSON.stringify(entityList, null, 2))
  } else if (options.output === 'ndjson') {
    for (const e of entityList) {
      console.log(JSON.stringify({ name: e.logicalName, displayName: e.displayName, entitySetName: e.entitySetName }))
    }
  } else {
    if (entityList.length === 0) {
      console.log('No entities found.')
      return
    }

    const rows = entityList.map((e) => [e.logicalName, e.displayName, e.entitySetName])
    console.log(renderTable(rows, ['LogicalName', 'DisplayName', 'EntitySetName']))
  }
}
