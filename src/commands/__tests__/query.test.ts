import { describe, it, expect, vi, beforeEach } from 'vitest'
import { query } from '../query.js'

const mockQuery = vi.fn()

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({}))
  return { AuthManager: MockAuthManager }
})

vi.mock('../../client/dataverse-client.js', () => {
  const MockDataverseClient = vi.fn().mockImplementation(() => ({
    query: mockQuery,
  }))
  return { DataverseClient: MockDataverseClient }
})

vi.mock('../../schema/schema-cache.js', () => {
  const MockSchemaCache = vi.fn().mockImplementation(() => ({}))
  return { SchemaCache: MockSchemaCache }
})

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

  it('throws on missing entity set name', async () => {
    await expect(query({ odata: '', output: 'json', pageAll: false }))
      .rejects.toThrow('OData expression must start with the entity set name')
  })
})
