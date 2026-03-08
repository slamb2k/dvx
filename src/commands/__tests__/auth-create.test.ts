import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authCreate } from '../auth-create.js'

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({
    createProfile: vi.fn(),
    getToken: vi.fn().mockResolvedValue('fake-token'),
  }))
  return { AuthManager: MockAuthManager }
})

describe('authCreate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('creates profile and validates token', async () => {
    await authCreate({
      name: 'test',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Profile 'test' created and validated successfully."),
    )
  })

  it('throws on token acquisition failure', async () => {
    const { AuthManager } = await import('../../auth/auth-manager.js')
    vi.mocked(AuthManager).mockImplementationOnce(() => ({
      createProfile: vi.fn(),
      getToken: vi.fn().mockRejectedValue(new Error('token failed')),
      getActiveProfile: vi.fn(),
      listProfiles: vi.fn(),
      selectProfile: vi.fn(),
    }) as unknown as InstanceType<typeof AuthManager>)

    await expect(authCreate({
      name: 'fail',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })).rejects.toThrow('token failed')
  })
})
