import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authList } from '../auth-list.js'

const { mockListProfiles } = vi.hoisted(() => ({
  mockListProfiles: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: { listProfiles: mockListProfiles },
    client: {},
  }),
}))

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
    const output = calls.find((c) => typeof c === 'string' && c.includes('*'))
    expect(output).toContain('dev')
    const prodLine = calls.find((c) => typeof c === 'string' && c.includes('prod'))
    expect(prodLine).toBeTruthy()
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
