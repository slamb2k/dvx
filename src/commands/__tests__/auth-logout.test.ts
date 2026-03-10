import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDeleteProfile, mockDeleteAllProfiles, mockGetActiveProfile } = vi.hoisted(() => ({
  mockDeleteProfile: vi.fn(),
  mockDeleteAllProfiles: vi.fn(),
  mockGetActiveProfile: vi.fn(),
}))

vi.mock('../../auth/auth-manager.js', () => ({
  AuthManager: vi.fn().mockImplementation(() => ({
    deleteProfile: mockDeleteProfile,
    deleteAllProfiles: mockDeleteAllProfiles,
    getActiveProfile: mockGetActiveProfile,
  })),
}))

import { authLogout } from '../auth-login.js'

describe('authLogout', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockDeleteProfile.mockReset()
    mockDeleteAllProfiles.mockReset()
    mockGetActiveProfile.mockReset()
  })

  it('removes active profile', async () => {
    mockGetActiveProfile.mockReturnValue({ name: 'dev', type: 'delegated' })

    await authLogout({})

    expect(mockDeleteProfile).toHaveBeenCalledWith('dev')
    expect(console.log).toHaveBeenCalledWith("Profile 'dev' removed.")
  })

  it('removes all profiles with --all', async () => {
    await authLogout({ all: true })

    expect(mockDeleteAllProfiles).toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith('All auth profiles removed.')
  })
})
