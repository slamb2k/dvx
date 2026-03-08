import { describe, it, expect, vi, beforeEach } from 'vitest'
import { entities } from '../entities.js'

const mockListEntities = vi.fn()

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({}))
  return { AuthManager: MockAuthManager }
})

vi.mock('../../client/dataverse-client.js', () => {
  const MockDataverseClient = vi.fn().mockImplementation(() => ({
    listEntities: mockListEntities,
  }))
  return { DataverseClient: MockDataverseClient }
})

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

  it('propagates errors from listEntities', async () => {
    mockListEntities.mockRejectedValue(new Error('API unavailable'))

    await expect(entities({ output: 'table' })).rejects.toThrow('API unavailable')
  })
})
