import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query } from '../query.js'

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { query: mockQuery },
  }),
}))

describe('query', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockQuery.mockReset()
  })

  it('outputs JSON records', async () => {
    const records = [{ accountid: '1', name: 'Acme' }]
    mockQuery.mockResolvedValue(records)

    await query({ odata: 'accounts?$filter=name ne null', output: 'json', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual(records)
  })

  it('throws when no query source provided', async () => {
    await expect(query({ output: 'json', pageAll: false }))
      .rejects.toThrow('Either --odata, --fetchxml, or --file is required')
  })
})
