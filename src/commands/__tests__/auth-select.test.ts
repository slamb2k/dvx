import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authSelect } from '../auth-select.js'
import { AuthProfileNotFoundError } from '../../errors.js'

const mockSelectProfile = vi.fn()

vi.mock('../../auth/auth-manager.js', () => {
  const MockAuthManager = vi.fn().mockImplementation(() => ({
    selectProfile: mockSelectProfile,
  }))
  return { AuthManager: MockAuthManager }
})

describe('authSelect', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockSelectProfile.mockReset()
  })

  it('switches active profile and prints confirmation', async () => {
    mockSelectProfile.mockImplementation(() => {})
    await authSelect('dev')
    expect(mockSelectProfile).toHaveBeenCalledWith('dev')
    expect(console.log).toHaveBeenCalledWith("Active profile switched to 'dev'.")
  })

  it('throws when profile not found', async () => {
    mockSelectProfile.mockImplementation(() => {
      throw new AuthProfileNotFoundError('missing')
    })
    await expect(authSelect('missing')).rejects.toThrow(AuthProfileNotFoundError)
  })
})
