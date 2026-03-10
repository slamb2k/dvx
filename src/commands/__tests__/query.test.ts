import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query } from '../query.js'

const { mockQuery, mockQueryFetchXml } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockQueryFetchXml: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { query: mockQuery, queryFetchXml: mockQueryFetchXml },
  }),
}))

vi.mock('../../utils/cli.js', async () => {
  const { createCliMock } = await import('../../__tests__/helpers/cli-mock.js')
  return createCliMock()
})

describe('query', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockQuery.mockReset()
    mockQueryFetchXml.mockReset()
  })

  it('outputs JSON records for OData query', async () => {
    const records = [{ accountid: '1', name: 'Acme' }]
    mockQuery.mockResolvedValue(records)

    await query({ odata: 'accounts?$filter=name ne null', output: 'json', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual(records)
  })

  it('streams ndjson records — one JSON line per record', async () => {
    mockQuery.mockImplementation(async (_entity: string, _odata: string, opts: { onRecord?: (r: unknown) => void }) => {
      await Promise.resolve()
      opts.onRecord?.({ accountid: '1', name: 'Acme' })
      await Promise.resolve()
      opts.onRecord?.({ accountid: '2', name: 'Globex' })
      return []
    })

    await query({ odata: 'accounts', output: 'ndjson', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[0]!)).toEqual({ accountid: '1', name: 'Acme' })
    expect(JSON.parse(calls[1]!)).toEqual({ accountid: '2', name: 'Globex' })
  })

  it('throws ValidationError when no query source provided', async () => {
    await expect(query({ output: 'json', pageAll: false }))
      .rejects.toThrow('Either --odata, --fetchxml, or --file is required')
  })

  it('throws ValidationError when OData has no entity set name', async () => {
    await expect(query({ odata: '?$filter=name eq "test"', output: 'json', pageAll: false }))
      .rejects.toThrow('entity set name')
  })

  it('passes fields to client.query', async () => {
    mockQuery.mockResolvedValue([])

    await query({ odata: 'accounts?$top=1', fields: 'name,accountid', output: 'json', pageAll: false })

    expect(mockQuery).toHaveBeenCalledWith('accounts', '$top=1', expect.objectContaining({
      fields: ['name', 'accountid'],
    }))
  })

  it('passes maxRows to client.query', async () => {
    mockQuery.mockResolvedValue([])

    await query({ odata: 'accounts?$top=1', maxRows: 100, output: 'json', pageAll: false })

    expect(mockQuery).toHaveBeenCalledWith('accounts', '$top=1', expect.objectContaining({
      maxRows: 100,
    }))
  })

  it('renders table output for OData query', async () => {
    mockQuery.mockResolvedValue([{ name: 'Acme', accountid: '1' }])

    await query({ odata: 'accounts?$top=1', output: 'table', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('name'))).toBe(true)
    expect(calls.some((c) => c.includes('Acme'))).toBe(true)
  })

  it('prints "No records found" for empty table output', async () => {
    mockQuery.mockResolvedValue([])

    await query({ odata: 'accounts?$top=1', output: 'table', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('No records found'))).toBe(true)
  })

  it('executes FetchXML query and returns JSON', async () => {
    const records = [{ name: 'Test', accountid: '1' }]
    mockQueryFetchXml.mockResolvedValue(records)

    const fetchXml = '<fetch><entity name="account"><attribute name="name" /></entity></fetch>'
    await query({ fetchxml: fetchXml, output: 'json', pageAll: false })

    expect(mockQueryFetchXml).toHaveBeenCalledWith('account', fetchXml)
    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual(records)
  })

  it('throws ValidationError when FetchXML has no entity name', async () => {
    const fetchXml = '<fetch><something /></fetch>'
    await expect(query({ fetchxml: fetchXml, output: 'json', pageAll: false }))
      .rejects.toThrow('Could not determine entity name')
  })

  it('streams FetchXML results as ndjson', async () => {
    mockQueryFetchXml.mockImplementation(async (_entity: string, _xml: string, onRecord?: (r: unknown) => void) => {
      onRecord?.({ name: 'A' })
      onRecord?.({ name: 'B' })
      return []
    })

    const fetchXml = '<fetch><entity name="account"><attribute name="name" /></entity></fetch>'
    await query({ fetchxml: fetchXml, output: 'ndjson', pageAll: false })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[0]!)).toEqual({ name: 'A' })
  })
})
