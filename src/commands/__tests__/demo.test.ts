import { describe, it, expect, vi, beforeEach } from 'vitest'
import { demo } from '../demo.js'

const {
  mockListEntities,
  mockGetEntitySchema,
  mockQuery,
  mockQueryFetchXml,
  mockGetRecord,
  mockCreateRecord,
  mockUpdateRecord,
  mockDeleteRecord,
  mockExecuteAction,
  mockExecuteBatch,
  mockCreateClient,
} = vi.hoisted(() => ({
  mockListEntities: vi.fn(),
  mockGetEntitySchema: vi.fn(),
  mockQuery: vi.fn(),
  mockQueryFetchXml: vi.fn(),
  mockGetRecord: vi.fn(),
  mockCreateRecord: vi.fn(),
  mockUpdateRecord: vi.fn(),
  mockDeleteRecord: vi.fn(),
  mockExecuteAction: vi.fn(),
  mockExecuteBatch: vi.fn(),
  mockCreateClient: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: mockCreateClient,
}))

vi.mock('../../utils/cli.js', async () => {
  const { createCliMock } = await import('../../__tests__/helpers/cli-mock.js')
  return createCliMock()
})

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn(), success: vi.fn() },
  cancel: vi.fn(),
  spinner: vi.fn().mockReturnValue({ start: vi.fn(), stop: vi.fn(), message: vi.fn() }),
}))

function makeClient() {
  return {
    listEntities: mockListEntities,
    getEntitySchema: mockGetEntitySchema,
    query: mockQuery,
    queryFetchXml: mockQueryFetchXml,
    getRecord: mockGetRecord,
    createRecord: mockCreateRecord,
    updateRecord: mockUpdateRecord,
    deleteRecord: mockDeleteRecord,
    executeAction: mockExecuteAction,
    executeBatch: mockExecuteBatch,
  }
}

function setupMocks() {
  const client = makeClient()
  mockCreateClient.mockResolvedValue({ authManager: {}, client })

  mockListEntities.mockResolvedValue([
    { logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' },
  ])
  mockGetEntitySchema.mockResolvedValue({
    logicalName: 'account',
    entitySetName: 'accounts',
    attributes: [{ logicalName: 'name', attributeType: 'String' }],
  })
  mockQuery.mockResolvedValue([])
  mockQueryFetchXml.mockResolvedValue([])
  mockGetRecord.mockResolvedValue({ name: 'Test', accountid: '00000000-0000-0000-0000-000000000001' })
  mockCreateRecord.mockResolvedValue('00000000-0000-0000-0000-000000000001')
  mockUpdateRecord.mockResolvedValue(undefined)
  mockDeleteRecord.mockResolvedValue(undefined)
  mockExecuteAction.mockResolvedValue({ UserId: '00000000-0000-0000-0000-000000000099' })
  mockExecuteBatch.mockResolvedValue('batch response')

  return client
}

describe('demo', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
  })

  it('read tier — only read demos run', async () => {
    setupMocks()
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'read' })

    expect(mockListEntities).toHaveBeenCalled()
    expect(mockGetEntitySchema).toHaveBeenCalledWith('account')
    expect(mockCreateRecord).not.toHaveBeenCalled()
    expect(mockUpdateRecord).not.toHaveBeenCalled()
    expect(mockExecuteAction).not.toHaveBeenCalled()
  })

  it('write tier — read + write demos run', async () => {
    setupMocks()
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'write' })

    expect(mockListEntities).toHaveBeenCalled()
    expect(mockCreateRecord).toHaveBeenCalled()
    // Verify demo data uses prefix
    const createCalls = mockCreateRecord.mock.calls
    for (const [, data] of createCalls) {
      const payload = data as Record<string, unknown>
      const nameField = (payload['name'] ?? payload['firstname']) as string
      expect(nameField).toContain('[dvx-demo]')
    }
    expect(mockDeleteRecord).toHaveBeenCalled()
    expect(mockExecuteAction).not.toHaveBeenCalled()
  })

  it('full tier — all 13 demos run', async () => {
    setupMocks()
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'full' })

    expect(mockListEntities).toHaveBeenCalled()
    expect(mockCreateRecord).toHaveBeenCalled()
    expect(mockExecuteAction).toHaveBeenCalledWith('WhoAmI', {})
    expect(mockExecuteBatch).toHaveBeenCalled()
  })

  it('non-interactive without --tier throws ValidationError', async () => {
    setupMocks()

    await expect(demo({})).rejects.toThrow('--tier is required')
  })

  it('cleanup runs on step failure', async () => {
    setupMocks()
    mockUpdateRecord.mockRejectedValue(new Error('Update failed'))

    await demo({ tier: 'write' })

    // Cleanup should still delete the created records
    expect(mockDeleteRecord).toHaveBeenCalled()
  })

  it('opportunity check failure does not abort demo', async () => {
    setupMocks()
    const { EntityNotFoundError } = await import('../../errors.js')
    mockGetEntitySchema.mockImplementation(async (entity: string) => {
      if (entity === 'opportunity') throw new EntityNotFoundError('opportunity')
      return {
        logicalName: entity,
        entitySetName: `${entity}s`,
        attributes: [{ logicalName: 'name', attributeType: 'String' }],
      }
    })
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'read' })

    expect(mockListEntities).toHaveBeenCalled()
  })

  it('opportunity DataverseError 404 does not abort demo', async () => {
    setupMocks()
    const { DataverseError } = await import('../../errors.js')
    mockGetEntitySchema.mockImplementation(async (entity: string) => {
      if (entity === 'opportunity') throw new DataverseError("EntityMetadata With Id = LogicalName='opportunity' does not exist.", 404)
      return {
        logicalName: entity,
        entitySetName: `${entity}s`,
        attributes: [{ logicalName: 'name', attributeType: 'String' }],
      }
    })
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'read' })

    expect(mockListEntities).toHaveBeenCalled()
  })

  it('summary table is printed to stdout', async () => {
    setupMocks()
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    await demo({ tier: 'read' })

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    const tableOutput = logCalls.join('\n')
    expect(tableOutput).toContain('List entities')
    expect(tableOutput).toContain('Schema introspection')
  })

  it('impersonation skip on privilege error', async () => {
    setupMocks()
    const { ImpersonationPrivilegeError } = await import('../../errors.js')
    mockQuery.mockResolvedValue([{ accountid: '00000000-0000-0000-0000-000000000001', name: 'Test' }])

    // First createClient call returns normal client, second throws
    let callCount = 0
    mockCreateClient.mockImplementation(async (opts?: { callerObjectId?: string }) => {
      callCount++
      if (opts?.callerObjectId) {
        throw new ImpersonationPrivilegeError()
      }
      return { authManager: {}, client: makeClient() }
    })
    // Reset mocks for the new client instance
    mockListEntities.mockResolvedValue([{ logicalName: 'account', displayName: 'Account', entitySetName: 'accounts' }])
    mockGetEntitySchema.mockResolvedValue({ logicalName: 'account', entitySetName: 'accounts', attributes: [{ logicalName: 'name', attributeType: 'String' }] })
    mockExecuteAction.mockResolvedValue({ UserId: '00000000-0000-0000-0000-000000000099' })

    // Should complete without throwing
    await demo({ tier: 'full' })

    const logCalls = vi.mocked(console.log).mock.calls.map((c) => c[0] as string)
    const tableOutput = logCalls.join('\n')
    expect(tableOutput).toContain('Impersonated query')
    expect(tableOutput).toContain('SKIP')
  })
})
