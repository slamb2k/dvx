import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteRecord } from '../delete.js'

const { mockDeleteRecord } = vi.hoisted(() => ({
  mockDeleteRecord: vi.fn(),
}))

const { mockIsInteractive, mockPromptConfirmClack } = vi.hoisted(() => ({
  mockIsInteractive: vi.fn().mockReturnValue(false),
  mockPromptConfirmClack: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { deleteRecord: mockDeleteRecord },
  }),
}))

vi.mock('../../utils/cli.js', () => ({
  isInteractive: mockIsInteractive,
  promptConfirmClack: mockPromptConfirmClack,
  createSpinner: () => ({ start() {}, stop() {}, message() {}, error() {} }),
  logMutationSuccess: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logStep: vi.fn(),
}))

describe('deleteRecord', () => {
  const validId = '00000000-0000-0000-0000-000000000001'

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    mockDeleteRecord.mockReset()
    mockIsInteractive.mockReset()
    mockIsInteractive.mockReturnValue(false)
    mockPromptConfirmClack.mockReset()
    mockPromptConfirmClack.mockResolvedValue(true)
  })

  it('deletes with --confirm flag', async () => {
    mockDeleteRecord.mockResolvedValue(undefined)

    await deleteRecord('account', validId, { confirm: true, dryRun: false })

    expect(mockDeleteRecord).toHaveBeenCalledWith('account', validId)
  })

  it('prompts for confirmation in interactive mode', async () => {
    mockIsInteractive.mockReturnValue(true)
    mockDeleteRecord.mockResolvedValue(undefined)
    mockPromptConfirmClack.mockResolvedValue(true)

    await deleteRecord('account', validId, { confirm: false, dryRun: false })

    expect(mockPromptConfirmClack).toHaveBeenCalled()
    expect(mockDeleteRecord).toHaveBeenCalled()
  })

  it('aborts when user declines confirmation', async () => {
    mockIsInteractive.mockReturnValue(true)
    mockPromptConfirmClack.mockResolvedValue(false)

    await deleteRecord('account', validId, { confirm: false, dryRun: false })

    expect(mockPromptConfirmClack).toHaveBeenCalled()
    expect(mockDeleteRecord).not.toHaveBeenCalled()
  })

  it('throws on not found error', async () => {
    mockDeleteRecord.mockRejectedValue(new Error('Record not found'))

    await expect(deleteRecord('account', validId, { confirm: true, dryRun: false }))
      .rejects.toThrow('Record not found')
  })
})
