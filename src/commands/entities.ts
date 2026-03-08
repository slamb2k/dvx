import { createClient } from '../client/create-client.js'
import { renderTable } from '../utils/table.js'

interface EntitiesOptions {
  output: 'json' | 'table'
}

export async function entities(options: EntitiesOptions): Promise<void> {
  const { client } = await createClient()

  const entityList = await client.listEntities()

  if (options.output === 'json') {
    console.log(JSON.stringify(entityList, null, 2))
  } else {
    if (entityList.length === 0) {
      console.log('No entities found.')
      return
    }

    const rows = entityList.map((e) => [e.logicalName, e.displayName, e.entitySetName])
    console.log(renderTable(rows, ['LogicalName', 'DisplayName', 'EntitySetName']))
  }
}
