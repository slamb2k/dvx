import { describe, it, expect, vi, beforeEach } from 'vitest'
import { batch } from '../batch.js'

const { mockExecuteBatch } = vi.hoisted(() => ({
  mockExecuteBatch: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { executeBatch: mockExecuteBatch },
  }),
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

import { readFile } from 'node:fs/promises'

describe('batch', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockExecuteBatch.mockReset()
  })

  it('executes a single batch', async () => {
    const ops = [{ method: 'POST', path: '/api/data/v9.2/accounts', body: { name: 'Acme' } }]
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(ops))
    mockExecuteBatch.mockResolvedValue('response')

    await batch({ file: 'ops.json', atomic: false, dryRun: false })

    expect(mockExecuteBatch).toHaveBeenCalledTimes(1)
  })

  it('chunks large batches at 1000 ops', async () => {
    const ops = Array.from({ length: 1500 }, (_, i) => ({
      method: 'POST',
      path: `/api/data/v9.2/accounts`,
      body: { name: `Account${i}` },
    }))
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(ops))
    mockExecuteBatch.mockResolvedValue('response')

    await batch({ file: 'ops.json', atomic: false, dryRun: false })

    expect(mockExecuteBatch).toHaveBeenCalledTimes(2)
  })

  it('passes atomic flag to batch builder', async () => {
    const ops = [{ method: 'POST', path: '/api/data/v9.2/accounts', body: { name: 'Acme' } }]
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(ops))
    mockExecuteBatch.mockResolvedValue('response')

    await batch({ file: 'ops.json', atomic: true, dryRun: false })

    const batchBody = mockExecuteBatch.mock.calls[0]![0] as string
    expect(batchBody).toContain('changeset')
  })
})
