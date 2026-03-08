import { describe, it, expect } from 'vitest'
import { buildBatchBody, chunkArray, type BatchOperation } from '../batch-builder.js'

describe('chunkArray', () => {
  it('splits array into chunks', () => {
    const result = chunkArray([1, 2, 3, 4, 5], 2)
    expect(result).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('buildBatchBody', () => {
  const boundary = 'batch_test'

  it('formats individual operations with boundary markers', () => {
    const ops: BatchOperation[] = [
      { method: 'GET', path: '/api/data/v9.2/accounts' },
    ]

    const result = buildBatchBody(ops, boundary)

    expect(result).toContain(`--${boundary}`)
    expect(result).toContain('GET /api/data/v9.2/accounts HTTP/1.1')
    expect(result).toContain(`--${boundary}--`)
  })

  it('wraps operations in changeset when atomic', () => {
    const ops: BatchOperation[] = [
      { method: 'POST', path: '/api/data/v9.2/accounts', body: { name: 'Acme' } },
    ]

    const result = buildBatchBody(ops, boundary, { atomic: true })

    expect(result).toContain('changeset')
    expect(result).toContain('multipart/mixed;boundary=changeset')
  })

  it('includes content IDs when specified', () => {
    const ops: BatchOperation[] = [
      { method: 'POST', path: '/api/data/v9.2/accounts', body: { name: 'Acme' }, contentId: '1' },
    ]

    const result = buildBatchBody(ops, boundary)

    expect(result).toContain('Content-ID: 1')
  })

  it('serializes body as JSON', () => {
    const ops: BatchOperation[] = [
      { method: 'POST', path: '/api/data/v9.2/accounts', body: { name: 'Test' } },
    ]

    const result = buildBatchBody(ops, boundary)

    expect(result).toContain('{"name":"Test"}')
  })
})
