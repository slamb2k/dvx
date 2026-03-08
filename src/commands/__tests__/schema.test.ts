import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schema } from '../schema.js'

const { mockGetEntitySchema } = vi.hoisted(() => ({
  mockGetEntitySchema: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: { getEntitySchema: mockGetEntitySchema },
  }),
}))

describe('schema', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGetEntitySchema.mockReset()
  })

  it('outputs entity schema as JSON', async () => {
    const schemaData = {
      logicalName: 'account',
      displayName: 'Account',
      entitySetName: 'accounts',
      primaryIdAttribute: 'accountid',
      primaryNameAttribute: 'name',
      attributes: [],
      cachedAt: new Date('2024-01-01'),
      ttlMs: 300000,
    }
    mockGetEntitySchema.mockResolvedValue(schemaData)

    await schema('account', { output: 'json', noCache: false })

    expect(mockGetEntitySchema).toHaveBeenCalledWith('account', false)
    expect(console.log).toHaveBeenCalled()
  })

  it('propagates errors from getEntitySchema', async () => {
    mockGetEntitySchema.mockRejectedValue(new Error('Schema fetch failed'))

    await expect(schema('badentity', { output: 'json', noCache: false })).rejects.toThrow(
      'Schema fetch failed',
    )
  })
})
