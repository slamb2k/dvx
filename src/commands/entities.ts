import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from '../client/dataverse-client.js'

interface EntitiesOptions {
  output: 'json' | 'table'
}

export async function entities(options: EntitiesOptions): Promise<void> {
  const authManager = new AuthManager()
  const client = new DataverseClient(authManager)

  const entityList = await client.listEntities()

  if (options.output === 'json') {
    console.log(JSON.stringify(entityList, null, 2))
  } else {
    // Simple table output
    if (entityList.length === 0) {
      console.log('No entities found.')
      return
    }

    const maxName = Math.max(...entityList.map((e) => e.logicalName.length), 12)
    const maxDisplay = Math.max(...entityList.map((e) => e.displayName.length), 12)

    console.log(
      'LogicalName'.padEnd(maxName + 2) +
      'DisplayName'.padEnd(maxDisplay + 2) +
      'EntitySetName',
    )
    console.log('-'.repeat(maxName + maxDisplay + 30))

    for (const entity of entityList) {
      console.log(
        entity.logicalName.padEnd(maxName + 2) +
        entity.displayName.padEnd(maxDisplay + 2) +
        entity.entitySetName,
      )
    }
  }
}
