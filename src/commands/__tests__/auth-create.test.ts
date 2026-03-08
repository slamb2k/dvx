import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authCreate } from '../auth-create.js'

const { mockCreateProfile, mockGetToken } = vi.hoisted(() => ({
  mockCreateProfile: vi.fn(),
  mockGetToken: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {
      createProfile: mockCreateProfile,
      getToken: mockGetToken,
    },
    client: {},
  }),
}))

describe('authCreate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateProfile.mockReset()
    mockGetToken.mockReset().mockResolvedValue('fake-token')
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
    mockGetToken.mockRejectedValue(new Error('token failed'))

    await expect(authCreate({
      name: 'fail',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })).rejects.toThrow('token failed')
  })
})
