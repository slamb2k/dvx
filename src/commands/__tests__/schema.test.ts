import { describe, it, expect, vi, beforeEach } from 'vitest'
import { schema } from '../schema.js'

const { mockGetEntitySchema, mockInvalidateSchema, mockClearSchemaCache } = vi.hoisted(() => ({
  mockGetEntitySchema: vi.fn(),
  mockInvalidateSchema: vi.fn(),
  mockClearSchemaCache: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: {
      getEntitySchema: mockGetEntitySchema,
      invalidateSchema: mockInvalidateSchema,
      clearSchemaCache: mockClearSchemaCache,
    },
  }),
}))

vi.mock('../../utils/cli.js', () => ({
  createSpinner: () => ({ start() {}, stop() {}, message() {}, error() {} }),
  isInteractive: () => false,
  logSuccess: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logStep: vi.fn(),
  logMutationSuccess: vi.fn(),
}))

describe('schema', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mockGetEntitySchema.mockReset()
    mockInvalidateSchema.mockReset()
    mockClearSchemaCache.mockReset()
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

  it('calls invalidateSchema when refresh is true', async () => {
    mockGetEntitySchema.mockResolvedValue({ logicalName: 'account', attributes: [] })

    await schema('account', { output: 'json', noCache: false, refresh: true })

    expect(mockInvalidateSchema).toHaveBeenCalledWith('account')
    expect(mockClearSchemaCache).not.toHaveBeenCalled()
  })

  it('calls clearSchemaCache when refreshAll is true', async () => {
    mockGetEntitySchema.mockResolvedValue({ logicalName: 'account', attributes: [] })

    await schema('account', { output: 'json', noCache: false, refreshAll: true })

    expect(mockClearSchemaCache).toHaveBeenCalled()
    expect(mockInvalidateSchema).not.toHaveBeenCalled()
  })

  it('outputs schema as table when output is table', async () => {
    const schemaData = {
      logicalName: 'account',
      displayName: 'Account',
      entitySetName: 'accounts',
      primaryIdAttribute: 'accountid',
      primaryNameAttribute: 'name',
      attributes: [
        { logicalName: 'name', displayName: 'Name', attributeType: 'String', requiredLevel: 'ApplicationRequired', isCustomAttribute: false },
        { logicalName: 'accountid', displayName: 'Account ID', attributeType: 'Uniqueidentifier', requiredLevel: 'SystemRequired', isCustomAttribute: false },
      ],
      cachedAt: new Date('2024-01-01'),
      ttlMs: 300000,
    }
    mockGetEntitySchema.mockResolvedValue(schemaData)

    await schema('account', { output: 'table', noCache: false })

    const output = vi.mocked(console.log).mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('LogicalName')
    expect(output).toContain('name')
    expect(output).toContain('String')
  })
})
