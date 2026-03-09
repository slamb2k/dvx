import { readFileSync } from 'node:fs'
import { createClient } from '../client/create-client.js'
import { validateFetchXml } from '../utils/fetchxml.js'

function printTable(records: Record<string, unknown>[]): void {
  if (records.length === 0) {
    console.log('No records found.')
    return
  }
  const keys = Object.keys(records[0]!).filter((k) => !k.startsWith('@'))
  console.log(keys.join('\t'))
  for (const record of records) {
    console.log(keys.map((k) => String(record[k] ?? '')).join('\t'))
  }
}

interface QueryOptions {
  odata?: string | undefined
  fetchxml?: string | undefined
  file?: string | undefined
  fields?: string | undefined
  pageAll: boolean
  maxRows?: number | undefined
  output: 'json' | 'ndjson' | 'table'
  dryRun?: boolean | undefined
}

export async function query(options: QueryOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun })

  let fetchXmlContent: string | undefined
  let entityName: string | undefined

  if (options.file) {
    const content = readFileSync(options.file, 'utf-8')
    if (content.trimStart().startsWith('<')) {
      fetchXmlContent = content
    } else {
      options.odata = content.trim()
    }
  }

  if (options.fetchxml) {
    fetchXmlContent = options.fetchxml
  }

  if (fetchXmlContent) {
    validateFetchXml(fetchXmlContent)

    const entityMatch = /entity\s+name=["']([^"']+)["']/i.exec(fetchXmlContent)
    entityName = entityMatch?.[1]
    if (!entityName) {
      throw new Error('Could not determine entity name from FetchXML')
    }

    if (options.output === 'ndjson' || options.pageAll) {
      await client.queryFetchXml(entityName, fetchXmlContent, (record) => {
        console.log(JSON.stringify(record))
      })
    } else {
      const records = await client.queryFetchXml(entityName, fetchXmlContent)

      if (options.output === 'json') {
        console.log(JSON.stringify(records, null, 2))
      } else {
        printTable(records as Record<string, unknown>[])
      }
    }
    return
  }

  if (!options.odata) {
    throw new Error('Either --odata, --fetchxml, or --file is required')
  }

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
      printTable(records)
    }
  }
}
