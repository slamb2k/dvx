import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authLogin } from '../auth-login.js'
import { PkceFlowError } from '../../errors.js'

const { mockCreateProfile, mockGetToken } = vi.hoisted(() => ({
  mockCreateProfile: vi.fn(),
  mockGetToken: vi.fn(),
}))

vi.mock('../../auth/auth-manager.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    createProfile: mockCreateProfile,
    getToken: mockGetToken,
  })),
}))

describe('authLogin', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateProfile.mockReset()
    mockGetToken.mockReset()
  })

  it('calls createProfile with type delegated and getToken', async () => {
    mockGetToken.mockResolvedValue('token')

    await authLogin({
      name: 'test-profile',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })

    expect(mockCreateProfile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'test-profile',
      type: 'delegated',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    }))
    expect(mockGetToken).toHaveBeenCalledWith('test-profile')
  })

  it('throws if getToken throws', async () => {
    mockGetToken.mockRejectedValue(new PkceFlowError('PKCE flow failed'))

    await expect(authLogin({
      name: 'test-profile',
      environmentUrl: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })).rejects.toThrow(PkceFlowError)
  })
})
