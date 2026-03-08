import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRecord } from '../create.js'

const { mockCreateRecord } = vi.hoisted(() => ({
  mockCreateRecord: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { createRecord: mockCreateRecord },
  }),
}))

describe('createRecord', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateRecord.mockReset()
  })

  it('creates a record and outputs the ID', async () => {
    mockCreateRecord.mockResolvedValue('00000000-0000-0000-0000-000000000001')

    await createRecord('account', { json: '{"name":"Acme"}', dryRun: false, output: 'json' })

    expect(mockCreateRecord).toHaveBeenCalledWith('account', { name: 'Acme' })
    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual({ ok: true, id: '00000000-0000-0000-0000-000000000001' })
  })

  it('passes dryRun to createClient', async () => {
    const { createClient } = await import('../../client/create-client.js')
    mockCreateRecord.mockResolvedValue('dry-run')

    await createRecord('account', { json: '{"name":"Acme"}', dryRun: true, output: 'table' })

    expect(createClient).toHaveBeenCalledWith({ dryRun: true, callerObjectId: undefined })
  })

  it('passes callerObjectId to createClient when asUser is set', async () => {
    const { createClient } = await import('../../client/create-client.js')
    mockCreateRecord.mockResolvedValue('00000000-0000-0000-0000-000000000001')

    await createRecord('account', { json: '{"name":"Acme"}', dryRun: false, callerObjectId: '00000000-0000-0000-0000-000000000099', output: 'table' })

    expect(createClient).toHaveBeenCalledWith({ dryRun: false, callerObjectId: '00000000-0000-0000-0000-000000000099' })
  })

  it('throws on invalid JSON', async () => {
    await expect(createRecord('account', { json: '{bad', dryRun: false }))
      .rejects.toThrow('Invalid JSON payload')
  })
})
