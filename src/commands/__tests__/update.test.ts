import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateRecord } from '../update.js'

const { mockUpdateRecord } = vi.hoisted(() => ({
  mockUpdateRecord: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { updateRecord: mockUpdateRecord },
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

describe('updateRecord', () => {
  const validId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateRecord.mockReset()
  })

  it('updates a record successfully', async () => {
    mockUpdateRecord.mockResolvedValue(undefined)

    await updateRecord('account', validId, { json: '{"name":"Updated"}', dryRun: false })

    expect(mockUpdateRecord).toHaveBeenCalledWith('account', validId, { name: 'Updated' })
  })

  it('throws on not found error', async () => {
    mockUpdateRecord.mockRejectedValue(new Error('Record not found'))

    await expect(updateRecord('account', validId, { json: '{"name":"x"}', dryRun: false }))
      .rejects.toThrow('Record not found')
  })

  it('throws on invalid GUID', async () => {
    await expect(updateRecord('account', 'bad-id', { json: '{"name":"x"}', dryRun: false }))
      .rejects.toThrow('Invalid GUID')
  })
})
