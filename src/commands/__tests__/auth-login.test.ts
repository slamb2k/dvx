import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateProfile, mockGetToken, mockListEntities, mockAcquireTokenInteractive, mockGetAllAccounts, mockGraphApi } = vi.hoisted(() => ({
  mockCreateProfile: vi.fn(),
  mockGetToken: vi.fn(),
  mockListEntities: vi.fn(),
  mockAcquireTokenInteractive: vi.fn(),
  mockGetAllAccounts: vi.fn(),
  mockGraphApi: vi.fn(),
}))

vi.mock('../../auth/auth-manager.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    createProfile: mockCreateProfile,
    getToken: mockGetToken,
  })),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: { createProfile: mockCreateProfile, getToken: mockGetToken },
    client: { listEntities: mockListEntities },
  }),
}))

vi.mock('@azure/msal-node', () => ({
  PublicClientApplication: vi.fn().mockImplementation(() => ({
    getAllAccounts: mockGetAllAccounts,
    acquireTokenInteractive: mockAcquireTokenInteractive,
  })),
}))

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn().mockReturnValue({
      api: mockGraphApi,
    }),
  },
}))

vi.mock('../../auth/msal-cache-plugin.js', () => ({
  MsalCachePlugin: vi.fn(),
}))

vi.mock('../../utils/browser.js', () => ({
  openBrowser: vi.fn(),
}))

import { authLogin } from '../auth-login.js'
import { PkceFlowError } from '../../errors.js'

describe('authLogin', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateProfile.mockReset()
    mockGetToken.mockReset()
    mockListEntities.mockReset()
    mockAcquireTokenInteractive.mockReset()
    mockGetAllAccounts.mockReset().mockResolvedValue([])
    mockGraphApi.mockReset()
  })

  it('creates delegated profile with provided client-id and signs in', async () => {
    mockGetToken.mockResolvedValue('token')

    await authLogin({
      name: 'test-profile',
      url: 'https://org.crm.dynamics.com',
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

  it('throws if delegated getToken throws', async () => {
    mockGetToken.mockRejectedValue(new PkceFlowError('PKCE flow failed'))

    await expect(authLogin({
      name: 'test-profile',
      url: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
    })).rejects.toThrow(PkceFlowError)
  })

  it('creates service principal profile and validates connection', async () => {
    mockListEntities.mockResolvedValue(Array.from({ length: 5 }))

    await authLogin({
      name: 'sp-profile',
      url: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
      clientSecret: 'test-secret',
      servicePrincipal: true,
    })

    expect(mockCreateProfile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'sp-profile',
      type: 'service-principal',
      clientSecret: 'test-secret',
    }))
    expect(mockListEntities).toHaveBeenCalled()
  })

  it('throws if service principal auth is missing client secret', async () => {
    delete process.env['DATAVERSE_CLIENT_SECRET']

    await expect(authLogin({
      name: 'sp-profile',
      url: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientId: '00000000-0000-0000-0000-000000000002',
      servicePrincipal: true,
    })).rejects.toThrow('Client secret required')
  })

  it('throws if service principal auth is missing client id', async () => {
    await expect(authLogin({
      name: 'sp-profile',
      url: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      clientSecret: 'test-secret',
      servicePrincipal: true,
    })).rejects.toThrow('Client ID required')
  })

  it('auto-provisions app via Graph when no client-id provided', async () => {
    mockAcquireTokenInteractive.mockResolvedValue({ accessToken: 'graph-token' })

    const mockPost = vi.fn()
      .mockResolvedValueOnce({ appId: 'auto-app-id', id: 'object-id' })
      .mockResolvedValueOnce({})

    const mockFilter = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        get: vi.fn()
          .mockResolvedValueOnce({ value: [{ id: 'crm-sp-id' }] })
          .mockResolvedValueOnce({ value: [{ id: 'dvx-sp-id' }] }),
      }),
    })

    mockGraphApi.mockReturnValue({ post: mockPost, filter: mockFilter })
    mockGetToken.mockResolvedValue('token')

    await authLogin({
      name: 'auto-profile',
      url: 'https://org.crm.dynamics.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
    })

    expect(mockCreateProfile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'auto-profile',
      type: 'delegated',
      clientId: 'auto-app-id',
    }))
  })
})
