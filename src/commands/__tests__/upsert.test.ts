import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertRecord } from '../upsert.js'

const { mockCreateRecord, mockUpdateRecord, mockQuery, mockGetEntitySchema } = vi.hoisted(() => ({
  mockCreateRecord: vi.fn(),
  mockUpdateRecord: vi.fn(),
  mockQuery: vi.fn(),
  mockGetEntitySchema: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: {
      createRecord: mockCreateRecord,
      updateRecord: mockUpdateRecord,
      query: mockQuery,
      getEntitySchema: mockGetEntitySchema,
    },
  }),
}))

vi.mock('../../utils/cli.js', async () => {
  const { createCliMock } = await import('../../__tests__/helpers/cli-mock.js')
  return createCliMock()
})

describe('upsertRecord', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateRecord.mockReset()
    mockUpdateRecord.mockReset()
    mockQuery.mockReset()
    mockGetEntitySchema.mockReset()
    mockGetEntitySchema.mockResolvedValue({
      entitySetName: 'accounts',
      primaryIdAttribute: 'accountid',
      attributes: [{ logicalName: 'name' }, { logicalName: 'accountid' }],
    })
  })

  it('creates when no match found', async () => {
    mockQuery.mockResolvedValue([])
    mockCreateRecord.mockResolvedValue('00000000-0000-0000-0000-000000000001')

    await upsertRecord('account', { matchField: 'name', json: '{"name":"Acme"}', dryRun: false, output: 'json' })

    expect(mockCreateRecord).toHaveBeenCalledWith('account', { name: 'Acme' })
    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual({ action: 'created', id: '00000000-0000-0000-0000-000000000001' })
  })

  it('updates when match found', async () => {
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000002' }])
    mockUpdateRecord.mockResolvedValue(undefined)

    await upsertRecord('account', { matchField: 'name', json: '{"name":"Acme"}', dryRun: false, output: 'json' })

    expect(mockUpdateRecord).toHaveBeenCalledWith('account', '00000000-0000-0000-0000-000000000002', { name: 'Acme' })
    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual({ action: 'updated', id: '00000000-0000-0000-0000-000000000002' })
  })

  it('throws on invalid entity name', async () => {
    await expect(upsertRecord('ac count', { matchField: 'name', json: '{"name":"Acme"}', dryRun: false }))
      .rejects.toThrow('Invalid entity logical name')
  })

  it('outputs table format on create', async () => {
    mockQuery.mockResolvedValue([])
    mockCreateRecord.mockResolvedValue('00000000-0000-0000-0000-000000000001')

    await upsertRecord('account', { matchField: 'name', json: '{"name":"Acme"}', dryRun: false, output: 'table' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls.some((c) => c.includes('created'))).toBe(true)
  })
})
