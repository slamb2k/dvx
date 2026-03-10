import { readFileSync } from 'node:fs'
import { createClient } from '../client/create-client.js'
import { validateFetchXml } from '../utils/fetchxml.js'
import { ValidationError } from '../errors.js'
import { renderTable } from '../utils/table.js'
import { createSpinner } from '../utils/cli.js'

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

function renderRecordTable(records: Record<string, unknown>[]): void {
  if (records.length === 0) {
    console.log('No records found.')
    return
  }
  const keys = Object.keys(records[0]!).filter((k) => !k.startsWith('@'))
  const rows = records.map((r) => keys.map((k) => String(r[k] ?? '')))
  console.log(renderTable(rows, keys))
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

  const s = createSpinner()

  if (fetchXmlContent) {
    validateFetchXml(fetchXmlContent)

    const entityMatch = /entity\s+name=["']([^"']+)["']/i.exec(fetchXmlContent)
    entityName = entityMatch?.[1]
    if (!entityName) {
      throw new ValidationError('Could not determine entity name from FetchXML')
    }

    s.start('Querying...')

    if (options.output === 'ndjson' || options.pageAll) {
      let count = 0
      try {
        await client.queryFetchXml(entityName, fetchXmlContent, (record) => {
          count++
          console.log(JSON.stringify(record))
        })
      } catch (err) {
        s.error('Query failed')
        throw err
      }
      s.stop(`Query complete: ${count} records`)
    } else {
      let records: unknown[]
      try {
        records = await client.queryFetchXml(entityName, fetchXmlContent)
      } catch (err) {
        s.error('Query failed')
        throw err
      }
      s.stop(`Query complete: ${records.length} records`)

      if (options.output === 'json') {
        console.log(JSON.stringify(records, null, 2))
      } else {
        renderRecordTable(records as Record<string, unknown>[])
      }
    }
    return
  }

  if (!options.odata) {
    throw new ValidationError('Either --odata, --fetchxml, or --file is required')
  }

  const odataParts = options.odata.split('?')
  const entitySetName = odataParts[0] ?? ''
  const odataQuery = odataParts.slice(1).join('?')

  if (!entitySetName) {
    throw new ValidationError('OData expression must start with the entity set name (e.g., "accounts?$filter=name eq \'test\'")')
  }

  const fields = options.fields?.split(',').map((f) => f.trim())

  s.start('Querying...')

  if (options.output === 'ndjson' || options.pageAll) {
    let count = 0
    try {
      await client.query(entitySetName, odataQuery, {
        fields,
        pageAll: options.pageAll,
        maxRows: options.maxRows,
        onRecord: (record) => {
          count++
          console.log(JSON.stringify(record))
        },
        onProgress: (info) => {
          s.message(`Page ${info.pageNumber} — ${info.recordCount} records...`)
        },
      })
    } catch (err) {
      s.error('Query failed')
      throw err
    }
    s.stop(`Query complete: ${count} records`)
  } else {
    let records: Record<string, unknown>[]
    try {
      records = await client.query(entitySetName, odataQuery, {
        fields,
        pageAll: false,
        maxRows: options.maxRows,
        onProgress: (info) => {
          s.message(`Page ${info.pageNumber} — ${info.recordCount} records...`)
        },
      })
    } catch (err) {
      s.error('Query failed')
      throw err
    }
    s.stop(`Query complete: ${records.length} records`)

    if (options.output === 'json') {
      console.log(JSON.stringify(records, null, 2))
    } else {
      renderRecordTable(records)
    }
  }
}
