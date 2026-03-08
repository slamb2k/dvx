import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authList } from '../auth-list.js'

const mockListProfiles = vi.fn()

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({
    listProfiles: mockListProfiles,
  }))
  return { AuthManager: MockAuthManager }
})

describe('authList', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('prints no profiles message when empty', async () => {
    mockListProfiles.mockReturnValue([])
    await authList({ output: 'table' })
    expect(console.log).toHaveBeenCalledWith('No auth profiles configured.')
  })

  it('prints table with * marker for active profile', async () => {
    mockListProfiles.mockReturnValue([
      { name: 'dev', active: true, profile: { environmentUrl: 'https://dev.crm.dynamics.com' } },
      { name: 'prod', active: false, profile: { environmentUrl: 'https://prod.crm.dynamics.com' } },
    ])
    await authList({ output: 'table' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    const activeLine = calls.find((c) => typeof c === 'string' && c.startsWith('*'))
    const inactiveLine = calls.find((c) => typeof c === 'string' && c.startsWith(' ') && c.includes('prod'))
    expect(activeLine).toContain('dev')
    expect(inactiveLine).toContain('prod')
  })

  it('outputs JSON format', async () => {
    mockListProfiles.mockReturnValue([
      { name: 'dev', active: true, profile: { environmentUrl: 'https://dev.crm.dynamics.com' } },
    ])
    await authList({ output: 'json' })

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    const jsonOutput = JSON.parse(calls[0] as string)
    expect(jsonOutput).toEqual([{ name: 'dev', active: true, environmentUrl: 'https://dev.crm.dynamics.com' }])
  })
})
