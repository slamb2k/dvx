import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildEntityToolDefinitions, handleEntityTool } from '../dynamic-tools.js'
import type { EntitySchemaCacheEntry } from '../../schema/schema-cache.js'

const fixtureSchema: EntitySchemaCacheEntry = {
  logicalName: 'account',
  displayName: 'Account',
  entitySetName: 'accounts',
  primaryIdAttribute: 'accountid',
  primaryNameAttribute: 'name',
  attributes: [
    {
      logicalName: 'name',
      displayName: 'Name',
      attributeType: 'String',
      requiredLevel: 'ApplicationRequired',
      isCustomAttribute: false,
    },
    {
      logicalName: 'telephone1',
      displayName: 'Phone',
      attributeType: 'String',
      requiredLevel: 'None',
      isCustomAttribute: false,
    },
  ],
  cachedAt: new Date(),
  ttlMs: 300000,
}

describe('buildEntityToolDefinitions', () => {
  it('generates 4 tools per entity', () => {
    const tools = buildEntityToolDefinitions([fixtureSchema])

    expect(tools).toHaveLength(4)
    const names = tools.map((t) => t.name)
    expect(names).toContain('create_account')
    expect(names).toContain('update_account')
    expect(names).toContain('get_account')
    expect(names).toContain('query_account')
  })

  it('get_ and update_ have id in required', () => {
    const tools = buildEntityToolDefinitions([fixtureSchema])
    const getTool = tools.find((t) => t.name === 'get_account')!
    const updateTool = tools.find((t) => t.name === 'update_account')!

    expect((getTool.inputSchema as { required: string[] }).required).toContain('id')
    expect((updateTool.inputSchema as { required: string[] }).required).toContain('id')
  })

  it('returns empty list for empty schemas array', () => {
    const tools = buildEntityToolDefinitions([])
    expect(tools).toHaveLength(0)
  })

  it('generates tools for multiple entities', () => {
    const schema2: EntitySchemaCacheEntry = {
      ...fixtureSchema,
      logicalName: 'contact',
      entitySetName: 'contacts',
    }
    const tools = buildEntityToolDefinitions([fixtureSchema, schema2])
    expect(tools).toHaveLength(8)
  })
})

describe('handleEntityTool', () => {
  const mockClient = {
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    getRecord: vi.fn(),
    getEntitySchema: vi.fn().mockResolvedValue(fixtureSchema),
    query: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getEntitySchema.mockResolvedValue(fixtureSchema)
  })

  it('dispatches create_ to createRecord', async () => {
    mockClient.createRecord.mockResolvedValue('new-id')

    const result = await handleEntityTool('create_account', { name: 'Acme' }, mockClient as never)

    expect(mockClient.createRecord).toHaveBeenCalledWith('account', { name: 'Acme' })
    expect(result.content[0]!.text).toBe(JSON.stringify('new-id'))
  })

  it('dispatches update_ to updateRecord', async () => {
    mockClient.updateRecord.mockResolvedValue(undefined)
    const id = '00000000-0000-0000-0000-000000000001'

    await handleEntityTool('update_account', { id, name: 'New Name' }, mockClient as never)

    expect(mockClient.updateRecord).toHaveBeenCalledWith('account', id, { name: 'New Name' })
  })

  it('dispatches get_ to getRecord', async () => {
    mockClient.getRecord.mockResolvedValue({ accountid: 'abc' })
    const id = '00000000-0000-0000-0000-000000000001'

    const result = await handleEntityTool('get_account', { id, fields: 'name,telephone1' }, mockClient as never)

    expect(mockClient.getRecord).toHaveBeenCalledWith('account', id, ['name', 'telephone1'])
    expect(result.content[0]!.text).toBe(JSON.stringify({ accountid: 'abc' }))
  })

  it('dispatches query_ to query with entity set name', async () => {
    mockClient.query.mockResolvedValue([{ name: 'Acme' }])

    const result = await handleEntityTool('query_account', { filter: "name eq 'Acme'" }, mockClient as never)

    expect(mockClient.query).toHaveBeenCalledWith('accounts', "$filter=name eq 'Acme'", { pageAll: true })
    expect(result.content[0]!.text).toBe(JSON.stringify([{ name: 'Acme' }]))
  })

  it('throws for unknown tool name', async () => {
    await expect(handleEntityTool('delete_account', {}, mockClient as never))
      .rejects.toThrow('Unknown entity tool: delete_account')
  })
})
