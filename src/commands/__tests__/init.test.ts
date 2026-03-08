import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateProfile, mockListEntities, mockGraphPost } = vi.hoisted(() => ({
  mockCreateProfile: vi.fn(),
  mockListEntities: vi.fn(),
  mockGraphPost: vi.fn(),
}))

vi.mock('../../auth/auth-manager.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    createProfile: mockCreateProfile,
  })),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { listEntities: mockListEntities },
  }),
}))

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn().mockReturnValue({
      api: vi.fn().mockReturnValue({
        post: mockGraphPost,
      }),
    }),
  },
}))

vi.mock('isomorphic-fetch', () => ({}))

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn()
      .mockResolvedValueOnce('tenant-id-1234-5678-abcd-ef0123456789')
      .mockResolvedValueOnce('https://org.crm.dynamics.com'),
    close: vi.fn(),
  }),
}))

import { init } from '../init.js'

describe('init', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCreateProfile.mockReset()
    mockListEntities.mockReset()
    mockGraphPost.mockReset()
  })

  it('falls back to manual instructions on Graph API failure', async () => {
    // Graph API throws on getAccessToken
    mockGraphPost.mockRejectedValue(new Error('Graph auth failed'))

    // After fallback: prompts for clientId and secret
    const { createInterface } = await import('node:readline/promises')
    vi.mocked(createInterface).mockReturnValue({
      question: vi.fn()
        .mockResolvedValueOnce('tenant-id-1234-5678-abcd-ef0123456789')
        .mockResolvedValueOnce('https://org.crm.dynamics.com')
        .mockResolvedValueOnce('manual-client-id-1234-5678-abcd-ef0123456789')
        .mockResolvedValueOnce('manual-secret'),
      close: vi.fn(),
    } as unknown as ReturnType<typeof createInterface>)

    mockListEntities.mockResolvedValue(Array.from({ length: 10 }))

    await init()

    const errorCalls = vi.mocked(console.error).mock.calls.map((c) => String(c[0]))
    const hasManualInstructions = errorCalls.some((c) => c.includes('Manual Setup Instructions'))
    expect(hasManualInstructions).toBe(true)
    expect(mockCreateProfile).toHaveBeenCalled()
  })

  it('calls createProfile and validates connection on success path', async () => {
    const { createInterface } = await import('node:readline/promises')
    vi.mocked(createInterface).mockReturnValue({
      question: vi.fn()
        .mockResolvedValueOnce('tenant-id-1234-5678-abcd-ef0123456789')
        .mockResolvedValueOnce('https://org.crm.dynamics.com')
        .mockResolvedValueOnce('manual-client-id-1234-5678-abcd-ef0123456789')
        .mockResolvedValueOnce('manual-secret'),
      close: vi.fn(),
    } as unknown as ReturnType<typeof createInterface>)

    mockListEntities.mockResolvedValue(Array.from({ length: 5 }))

    await init()

    expect(mockCreateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'default',
        type: 'service-principal',
        environmentUrl: 'https://org.crm.dynamics.com',
      })
    )
    expect(mockListEntities).toHaveBeenCalled()

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c[0])
    const lastLog = JSON.parse(logCalls[logCalls.length - 1] as string)
    expect(lastLog).toMatchObject({ ok: true, profile: 'default', entityCount: 5 })
  })
})
