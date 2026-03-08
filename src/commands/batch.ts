import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { createClient } from '../client/create-client.js'
import { buildBatchBody, chunkArray, type BatchOperation } from '../utils/batch-builder.js'
import { parseJsonPayload } from '../utils/parse-json.js'

const BatchOperationSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  contentId: z.string().optional(),
})

const BatchFileSchema = z.array(BatchOperationSchema)

interface BatchOptions {
  file: string
  atomic: boolean
  dryRun: boolean
  callerObjectId?: string
}

export async function batch(options: BatchOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const content = readFileSync(options.file, 'utf-8')
  const parsed: unknown = parseJsonPayload(content)

  const operations = BatchFileSchema.parse(parsed) as BatchOperation[]
  const chunks = chunkArray(operations, 1000)

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const boundary = `batch_dvx_${Date.now()}_${i}`

    console.error(`Processing batch chunk ${i + 1}/${chunks.length} (${chunk.length} operations)`)

    const body = buildBatchBody(chunk, boundary, { atomic: options.atomic })
    const result = await client.executeBatch(body, boundary)

    console.log(JSON.stringify({ chunk: i + 1, totalChunks: chunks.length, operations: chunk.length, responseLength: result.length }))
  }
}
