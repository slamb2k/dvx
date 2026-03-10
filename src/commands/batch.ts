import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { createClient } from '../client/create-client.js'
import { buildBatchBody, chunkArray, type BatchOperation } from '../utils/batch-builder.js'
import { ValidationError } from '../errors.js'
import { formatMutationResult } from '../utils/output.js'
import { BaseMutationOptions } from './types.js'
import { createSpinner, logSuccess } from '../utils/cli.js'

const BatchOperationSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  path: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  contentId: z.string().optional(),
})

const BatchFileSchema = z.array(BatchOperationSchema)

interface BatchOptions extends BaseMutationOptions {
  file: string
  atomic: boolean
}

export async function batch(options: BatchOptions): Promise<void> {
  const { client } = await createClient({ dryRun: options.dryRun, callerObjectId: options.callerObjectId })

  const content = await readFile(options.file, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new ValidationError('Invalid JSON in batch file')
  }

  const operations = BatchFileSchema.parse(parsed) as BatchOperation[]
  const chunks = chunkArray(operations, 1000)
  const totalOps = operations.length

  const s = createSpinner()

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const boundary = `batch_dvx_${Date.now()}_${i}`

    s.start(`Chunk ${i + 1}/${chunks.length} (${chunk.length} operations)...`)

    let result: string
    try {
      const body = buildBatchBody(chunk, boundary, { atomic: options.atomic })
      result = await client.executeBatch(body, boundary)
    } catch (err) {
      s.error(`Chunk ${i + 1}/${chunks.length} failed`)
      throw err
    }

    s.stop(`Chunk ${i + 1}/${chunks.length} complete`)

    formatMutationResult(
      { chunk: i + 1, totalChunks: chunks.length, operations: chunk.length, responseLength: result.length },
      { format: options.output ?? 'table' }
    )
  }

  logSuccess(`Batch complete: ${totalOps} operations across ${chunks.length} chunk${chunks.length === 1 ? '' : 's'}`)
}
