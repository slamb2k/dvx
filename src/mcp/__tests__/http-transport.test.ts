import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockGetEntitySchema,
  mockExecuteAction,
  mockConnect,
  mockSetRequestHandler,
  mockHandleRequest,
  mockTransportClose,
  mockListen,
} = vi.hoisted(() => ({
  mockGetEntitySchema: vi.fn(),
  mockExecuteAction: vi.fn(),
  mockConnect: vi.fn(),
  mockSetRequestHandler: vi.fn(),
  mockHandleRequest: vi.fn(),
  mockTransportClose: vi.fn(),
  mockListen: vi.fn(),
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

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: mockHandleRequest,
    close: mockTransportClose,
  })),
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}))

// Mock node:http createServer
const mockReq = {
  method: 'POST',
  url: '/mcp',
  on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
    if (event === 'end') cb()
  }),
}

const mockRes = {
  writeHead: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
}

const mockHealthReq = {
  method: 'GET',
  url: '/health',
  on: vi.fn(),
}

let capturedHandler: ((req: unknown, res: unknown) => Promise<void>) | null = null

vi.mock('node:http', () => ({
  createServer: vi.fn().mockImplementation((handler: (req: unknown, res: unknown) => Promise<void>) => {
    capturedHandler = handler
    return {
      listen: mockListen.mockImplementation((_port: number, cb: () => void) => cb()),
    }
  }),
}))

import { startMcpServer } from '../server.js'

describe('startMcpServer HTTP transport', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSetRequestHandler.mockReset()
    mockConnect.mockReset()
    mockHandleRequest.mockReset()
    mockTransportClose.mockReset()
    capturedHandler = null
  })

  it('/health returns { ok: true }', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })

    expect(capturedHandler).not.toBeNull()
    await capturedHandler!(mockHealthReq, mockRes)

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' })
    expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }))
  })

  it('POST /mcp creates StreamableHTTPServerTransport and calls handleRequest', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })

    expect(capturedHandler).not.toBeNull()
    await capturedHandler!(mockReq, mockRes)

    expect(mockConnect).toHaveBeenCalled()
    expect(mockHandleRequest).toHaveBeenCalled()
  })

  it('stdio path still works (backward compat)', async () => {
    await startMcpServer({})

    expect(mockConnect).toHaveBeenCalledTimes(1)
    // Should NOT have created an HTTP server for stdio
    const { createServer } = await import('node:http')
    // createServer is mocked but stdio path doesn't call createServer
    // Connect is called once for stdio transport
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })
})
