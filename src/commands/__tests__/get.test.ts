import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from '../get.js'

const mockGetRecord = vi.fn()

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({}))
  return { AuthManager: MockAuthManager }
})

vi.mock('../../client/dataverse-client.js', () => {
  const MockDataverseClient = vi.fn().mockImplementation(() => ({
    getRecord: mockGetRecord,
  }))
  return { DataverseClient: MockDataverseClient }
})

describe('get', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGetRecord.mockReset()
  })

  it('outputs JSON by default', async () => {
    const record = { accountid: '123', name: 'Test Account' }
    mockGetRecord.mockResolvedValue(record)

    await get('account', '00000000-0000-0000-0000-000000000001', { output: 'json' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual(record)
  })

  it('outputs table format with Field/Value layout', async () => {
    const record = { accountid: '123', name: 'Test Account' }
    mockGetRecord.mockResolvedValue(record)

    await get('account', '00000000-0000-0000-0000-000000000001', { output: 'table' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(calls[0]).toContain('Field')
    expect(calls[0]).toContain('Value')
    expect(calls.some((c) => typeof c === 'string' && c.includes('accountid'))).toBe(true)
    expect(calls.some((c) => typeof c === 'string' && c.includes('Test Account'))).toBe(true)
  })

  it('filters out @odata fields in table output', async () => {
    const record = { accountid: '123', '@odata.context': 'some-url' }
    mockGetRecord.mockResolvedValue(record)

    await get('account', '00000000-0000-0000-0000-000000000001', { output: 'table' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(calls.some((c) => typeof c === 'string' && c.includes('@odata'))).toBe(false)
  })
})
