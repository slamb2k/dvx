import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetEntitySchema, mockExecuteAction, mockConnect, mockSetRequestHandler } = vi.hoisted(() => ({
  mockGetEntitySchema: vi.fn(),
  mockExecuteAction: vi.fn(),
  mockConnect: vi.fn(),
  mockSetRequestHandler: vi.fn(),
}))

vi.mock('../../client/create-client.js', () => ({
  createClient: vi.fn().mockResolvedValue({
    authManager: {},
    client: {
      getEntitySchema: mockGetEntitySchema,
      executeAction: mockExecuteAction,
      listEntities: vi.fn(),
    },
  }),
}))

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: mockSetRequestHandler,
    connect: mockConnect,
  })),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}))

import { startMcpServer } from '../server.js'

describe('startMcpServer', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSetRequestHandler.mockReset()
    mockConnect.mockReset()
    mockGetEntitySchema.mockReset()
  })

  it('registers ListTools and CallTool handlers', async () => {
    await startMcpServer({})

    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2)
    expect(mockSetRequestHandler).toHaveBeenCalledWith('ListToolsRequestSchema', expect.any(Function))
    expect(mockSetRequestHandler).toHaveBeenCalledWith('CallToolRequestSchema', expect.any(Function))
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('tool list includes all 5 meta-tools', async () => {
    await startMcpServer({})

    const listHandler = mockSetRequestHandler.mock.calls[0]![1] as () => Promise<{ tools: Array<{ name: string }> }>
    const { tools } = await listHandler()
    const toolNames = tools.map((t) => t.name)

    expect(toolNames).toContain('discover_entity')
    expect(toolNames).toContain('list_entities')
    expect(toolNames).toContain('execute_query')
    expect(toolNames).toContain('execute_action')
    expect(toolNames).toContain('batch_execute')
  })

  it('execute_action call dispatches to client.executeAction', async () => {
    mockExecuteAction.mockResolvedValue({ result: 'done' })

    await startMcpServer({})

    const callHandler = mockSetRequestHandler.mock.calls[1]![1] as (
      req: { params: { name: string; arguments: Record<string, unknown> } }
    ) => Promise<unknown>

    const result = await callHandler({
      params: { name: 'execute_action', arguments: { name: 'WinOpportunity', payload: { Status: 3 } } },
    })

    expect(mockExecuteAction).toHaveBeenCalledWith(
      'WinOpportunity',
      { Status: 3 },
      { entityName: undefined, id: undefined },
    )
    expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ result: 'done' }) }] })
  })

  it('does not fetch entity schemas when --entities not provided', async () => {
    await startMcpServer({})

    expect(mockGetEntitySchema).not.toHaveBeenCalled()
  })

  it('fetches schemas for named entities when --entities provided', async () => {
    const mockSchema = {
      logicalName: 'account',
      entitySetName: 'accounts',
      attributes: [],
      displayName: 'Account',
      primaryIdAttribute: 'accountid',
      primaryNameAttribute: 'name',
      cachedAt: new Date(),
      ttlMs: 300000,
    }
    mockGetEntitySchema.mockResolvedValue(mockSchema)

    await startMcpServer({ entities: ['account'] })

    expect(mockGetEntitySchema).toHaveBeenCalledWith('account')
  })
})
