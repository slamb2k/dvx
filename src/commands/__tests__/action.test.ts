import { describe, it, expect, vi, beforeEach } from 'vitest'
import { actionCommand } from '../action.js'

const { mockExecuteAction } = vi.hoisted(() => ({
  mockExecuteAction: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { executeAction: mockExecuteAction },
  }),
}))

describe('actionCommand', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockExecuteAction.mockReset()
  })

  it('executes an unbound action and outputs result', async () => {
    mockExecuteAction.mockResolvedValue({ result: 'ok' })

    await actionCommand('WinOpportunity', { json: '{"Status":3}', output: 'json' })

    expect(mockExecuteAction).toHaveBeenCalledWith('WinOpportunity', { Status: 3 }, { entityName: undefined, id: undefined })
    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual({ result: 'ok' })
  })

  it('executes a bound action with entity and id', async () => {
    mockExecuteAction.mockResolvedValue(null)
    const id = '00000000-0000-0000-0000-000000000001'

    await actionCommand('RouteCaseToQueue', { json: '{}', entity: 'incident', id })

    expect(mockExecuteAction).toHaveBeenCalledWith('RouteCaseToQueue', {}, { entityName: 'incident', id })
  })

  it('forwards dryRun to createClient', async () => {
    const { createClient } = await import('../../client/create-client.js')
    mockExecuteAction.mockResolvedValue(null)

    await actionCommand('TestAction', { json: '{}', dryRun: true })

    expect(createClient).toHaveBeenCalledWith({ dryRun: true })
  })

  it('throws ValidationError when only --entity is provided', async () => {
    await expect(actionCommand('TestAction', { json: '{}', entity: 'incident' }))
      .rejects.toThrow('--entity and --id must both be provided for bound actions')
  })

  it('throws ValidationError when only --id is provided', async () => {
    await expect(actionCommand('TestAction', { json: '{}', id: '00000000-0000-0000-0000-000000000001' }))
      .rejects.toThrow('--entity and --id must both be provided for bound actions')
  })

  it('throws on invalid JSON payload', async () => {
    await expect(actionCommand('TestAction', { json: '{bad' }))
      .rejects.toThrow('Invalid JSON payload')
  })
})
