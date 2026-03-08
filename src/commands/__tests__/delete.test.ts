import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deleteRecord } from '../delete.js'

const { mockDeleteRecord } = vi.hoisted(() => ({
  mockDeleteRecord: vi.fn(),
}))

const { mockPromptConfirm } = vi.hoisted(() => ({
  mockPromptConfirm: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { deleteRecord: mockDeleteRecord },
  }),
}))

vi.mock('../../utils/confirm.js', () => ({
  promptConfirm: mockPromptConfirm,
}))

describe('deleteRecord', () => {
  const validId = '00000000-0000-0000-0000-000000000001'
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockDeleteRecord.mockReset()
    mockPromptConfirm.mockReset()
    mockPromptConfirm.mockResolvedValue(true)
    originalIsTTY = process.stdout.isTTY
  })

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY as boolean
  })

  it('deletes with --confirm flag', async () => {
    mockDeleteRecord.mockResolvedValue(undefined)

    await deleteRecord('account', validId, { confirm: true, dryRun: false })

    expect(mockDeleteRecord).toHaveBeenCalledWith('account', validId)
  })

  it('prompts for confirmation in TTY mode', async () => {
    process.stdout.isTTY = true
    mockDeleteRecord.mockResolvedValue(undefined)
    mockPromptConfirm.mockResolvedValue(true)

    await deleteRecord('account', validId, { confirm: false, dryRun: false })

    expect(mockPromptConfirm).toHaveBeenCalled()
    expect(mockDeleteRecord).toHaveBeenCalled()
  })

  it('aborts when user declines confirmation', async () => {
    process.stdout.isTTY = true
    mockPromptConfirm.mockResolvedValue(false)

    await deleteRecord('account', validId, { confirm: false, dryRun: false })

    expect(mockPromptConfirm).toHaveBeenCalled()
    expect(mockDeleteRecord).not.toHaveBeenCalled()
  })

  it('throws on not found error', async () => {
    mockDeleteRecord.mockRejectedValue(new Error('Record not found'))

    await expect(deleteRecord('account', validId, { confirm: true, dryRun: false }))
      .rejects.toThrow('Record not found')
  })
})
