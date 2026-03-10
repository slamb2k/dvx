import { describe, it, expect, vi, beforeEach } from 'vitest'
import { entities } from '../entities.js'

const { mockListEntities } = vi.hoisted(() => ({
  mockListEntities: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { listEntities: mockListEntities },
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

describe('entities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockListEntities.mockReset()
  })

  it('handles empty entity list without error', async () => {
    mockListEntities.mockResolvedValue([])
    await entities({ output: 'table' })
    expect(console.log).toHaveBeenCalledWith('No entities found.')
  })

  it('prints table with entity data', async () => {
    mockListEntities.mockResolvedValue([
      { logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' },
    ])
    await entities({ output: 'table' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(calls.some((c) => typeof c === 'string' && c.includes('account'))).toBe(true)
  })

  it('outputs JSON format', async () => {
    const data = [
      { logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' },
    ]
    mockListEntities.mockResolvedValue(data)
    await entities({ output: 'json' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    expect(JSON.parse(calls[0] as string)).toEqual(data)
  })

  it('outputs ndjson format — one JSON object per entity', async () => {
    mockListEntities.mockResolvedValue([
      { logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' },
      { logicalName: 'contact', displayName: 'Contact', entitySetName: 'contacts' },
    ])
    await entities({ output: 'ndjson' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    expect(calls).toHaveLength(2)
    expect(JSON.parse(calls[0]!)).toEqual({ name: 'account', displayName: 'Account', entitySetName: 'accounts' })
    expect(JSON.parse(calls[1]!)).toEqual({ name: 'contact', displayName: 'Contact', entitySetName: 'contacts' })
  })

  it('propagates errors from listEntities', async () => {
    mockListEntities.mockRejectedValue(new Error('API unavailable'))

    await expect(entities({ output: 'table' })).rejects.toThrow('API unavailable')
  })
})
