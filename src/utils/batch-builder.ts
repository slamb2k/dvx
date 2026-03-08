export interface BatchOperation {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  headers?: Record<string, string>
  body?: unknown
  contentId?: string
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function serializeOperation(op: BatchOperation, boundary: string): string[] {
  const parts: string[] = []
  parts.push(`--${boundary}`)
  parts.push('Content-Type: application/http')
  parts.push('Content-Transfer-Encoding: binary')
  if (op.contentId) {
    parts.push(`Content-ID: ${op.contentId}`)
  }
  parts.push('')
  parts.push(`${op.method} ${op.path} HTTP/1.1`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(op.headers ?? {}),
  }
  for (const [key, value] of Object.entries(headers)) {
    parts.push(`${key}: ${value}`)
  }
  parts.push('')
  if (op.body !== undefined) {
    parts.push(JSON.stringify(op.body))
  }
  parts.push('')
  return parts
}

export function buildBatchBody(
  operations: BatchOperation[],
  batchBoundary: string,
  options?: { atomic?: boolean; changesetSize?: number },
): string {
  const parts: string[] = []
  const changesetSize = options?.changesetSize ?? 100

  if (options?.atomic) {
    const chunks = chunkArray(operations, changesetSize)
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]!
      const changesetBoundary = `changeset_${batchBoundary}_${chunkIndex}`
      parts.push(`--${batchBoundary}`)
      parts.push(`Content-Type: multipart/mixed;boundary=${changesetBoundary}`)
      parts.push('')

      for (const op of chunk) {
        parts.push(...serializeOperation(op, changesetBoundary))
      }

      parts.push(`--${changesetBoundary}--`)
    }
  } else {
    for (const op of operations) {
      parts.push(...serializeOperation(op, batchBoundary))
    }
  }

  parts.push(`--${batchBoundary}--`)
  return parts.join('\r\n')
}
