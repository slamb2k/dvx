import { AuthManager } from '../auth/auth-manager.js'
import { DataverseClient } from '../client/dataverse-client.js'
import { SchemaCache } from '../schema/schema-cache.js'

interface QueryOptions {
  odata: string
  fields?: string
  pageAll: boolean
  maxRows?: number
  output: 'json' | 'ndjson' | 'table'
}

export async function query(options: QueryOptions): Promise<void> {
  const authManager = new AuthManager()
  const schemaCache = new SchemaCache()
  const client = new DataverseClient(authManager, schemaCache)

  // Extract entity set name from OData expression
  // The OData expression should be like: entitySetName?$filter=...
  // Or the user provides the full expression starting with the entity set name
  const odataParts = options.odata.split('?')
  const entitySetName = odataParts[0] ?? ''
  const odataQuery = odataParts.slice(1).join('?')

  if (!entitySetName) {
    throw new Error('OData expression must start with the entity set name (e.g., "accounts?$filter=name eq \'test\'")')
  }

  const fields = options.fields?.split(',').map((f) => f.trim())

  if (options.output === 'ndjson' || options.pageAll) {
    // Stream mode: emit one record per line
    await client.query(entitySetName, odataQuery, {
      fields,
      pageAll: options.pageAll,
      maxRows: options.maxRows,
      onRecord: (record) => {
        console.log(JSON.stringify(record))
      },
    })
  } else {
    const records = await client.query(entitySetName, odataQuery, {
      fields,
      pageAll: false,
      maxRows: options.maxRows,
    })

    if (options.output === 'json') {
      console.log(JSON.stringify(records, null, 2))
    } else {
      // Table output
      if (records.length === 0) {
        console.log('No records found.')
        return
      }

      const keys = Object.keys(records[0] ?? {}).filter((k) => !k.startsWith('@'))
      console.log(keys.join('\t'))
      for (const record of records) {
        console.log(keys.map((k) => String(record[k] ?? '')).join('\t'))
      }
    }
  }
}
