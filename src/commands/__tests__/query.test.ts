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

vi.mock('../../utils/cli.js', () => ({
  createSpinner: () => ({ start() {}, stop() {}, message() {}, error() {} }),
  isInteractive: () => false,
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logStep: vi.fn(),
  logMutationSuccess: vi.fn(),
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

  it('streams ndjson records — one JSON line per record', async () => {
    // In ndjson mode, query() calls client.query with an onRecord callback instead of returning an array
    mockQuery.mockImplementation(async (_entity: string, _odata: string, opts: { onRecord?: (r: unknown) => void }) => {
      opts.onRecord?.({ accountid: '1', name: 'Acme' })
      opts.onRecord?.({ accountid: '2', name: 'Globex' })
    })

    await query({ odata: 'accounts', output: 'ndjson', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[0]!)).toEqual({ accountid: '1', name: 'Acme' })
    expect(JSON.parse(calls[1]!)).toEqual({ accountid: '2', name: 'Globex' })
  })

  it('throws when no query source provided', async () => {
    await expect(query({ output: 'json', pageAll: false }))
      .rejects.toThrow('Either --odata, --fetchxml, or --file is required')
  })
})
