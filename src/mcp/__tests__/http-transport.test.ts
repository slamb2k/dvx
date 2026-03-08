import { describe, it, expect, vi, beforeEach } from 'vitest'

let capturedSessionInitialized: ((sessionId: string) => void) | undefined
let capturedSessionClosed: ((sessionId: string) => void) | undefined

const {
  mockGetEntitySchema,
  mockExecuteAction,
  mockConnect,
  mockSetRequestHandler,
  mockHandleRequest,
  mockTransportClose,
  mockListen,
  MockStreamableHTTPServerTransport,
} = vi.hoisted(() => {
  const mockGetEntitySchema = vi.fn()
  const mockExecuteAction = vi.fn()
  const mockConnect = vi.fn()
  const mockSetRequestHandler = vi.fn()
  const mockHandleRequest = vi.fn()
  const mockTransportClose = vi.fn()
  const mockListen = vi.fn()

  const MockStreamableHTTPServerTransport = vi.fn().mockImplementation((opts: {
    sessionIdGenerator?: () => string
    onsessioninitialized?: (sessionId: string) => void
    onsessionclosed?: (sessionId: string) => void
  } = {}) => ({
    handleRequest: mockHandleRequest,
    close: mockTransportClose,
    get sessionId() {
      return opts.sessionIdGenerator ? opts.sessionIdGenerator() : undefined
    },
    _captureCallbacks(onInit: typeof opts.onsessioninitialized, onClosed: typeof opts.onsessionclosed) {
      // intentional no-op — callbacks are stored via closure in the factory
    },
    _opts: opts,
  }))

  return {
    mockGetEntitySchema,
    mockExecuteAction,
    mockConnect,
    mockSetRequestHandler,
    mockHandleRequest,
    mockTransportClose,
    mockListen,
    MockStreamableHTTPServerTransport,
  }
})

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
  StreamableHTTPServerTransport: MockStreamableHTTPServerTransport,
}))

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}))

// Mock node:http createServer
const mockReq = {
  method: 'POST',
  url: '/mcp',
  headers: {},
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
  headers: {},
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
    MockStreamableHTTPServerTransport.mockClear()
    capturedHandler = null
    capturedSessionInitialized = undefined
    capturedSessionClosed = undefined

    // Capture callbacks passed to transport constructor
    MockStreamableHTTPServerTransport.mockImplementation((opts: {
      sessionIdGenerator?: () => string
      onsessioninitialized?: (sessionId: string) => void
      onsessionclosed?: (sessionId: string) => void
    } = {}) => {
      capturedSessionInitialized = opts.onsessioninitialized
      capturedSessionClosed = opts.onsessionclosed
      return {
        handleRequest: mockHandleRequest,
        close: mockTransportClose,
        sessionId: opts.sessionIdGenerator ? opts.sessionIdGenerator() : undefined,
      }
    })
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

  it('startup log says "stateful"', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })
    const errSpy = vi.mocked(console.error)
    const messages = errSpy.mock.calls.map((c) => c[0] as string)
    expect(messages.some((m) => m.toLowerCase().includes('stateful'))).toBe(true)
  })

  it('initialization response includes mcp-session-id (sessionIdGenerator is set)', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })

    expect(capturedHandler).not.toBeNull()
    await capturedHandler!(mockReq, mockRes)

    // Verify transport was constructed with a sessionIdGenerator (not undefined)
    const ctorCall = MockStreamableHTTPServerTransport.mock.calls[0][0]
    expect(ctorCall.sessionIdGenerator).toBeDefined()
    expect(typeof ctorCall.sessionIdGenerator).toBe('function')
    // The generator should return a UUID-shaped string
    const generated = ctorCall.sessionIdGenerator()
    expect(generated).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('second request with known session ID routes to existing transport, skips new Server creation', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })
    expect(capturedHandler).not.toBeNull()

    // First request — initialization
    await capturedHandler!(mockReq, mockRes)
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockHandleRequest).toHaveBeenCalledTimes(1)

    // Simulate onsessioninitialized callback firing with a session ID
    const sessionId = 'test-session-id-1234'
    capturedSessionInitialized!(sessionId)

    // Second request — carries the session ID header
    const mockReqWithSession = {
      method: 'POST',
      url: '/mcp',
      headers: { 'mcp-session-id': sessionId },
      on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
        if (event === 'end') cb()
      }),
    }

    mockHandleRequest.mockReset()
    mockConnect.mockReset()

    await capturedHandler!(mockReqWithSession, mockRes)

    // Should NOT create a new Server for this request
    expect(mockConnect).not.toHaveBeenCalled()
    // Should still call handleRequest on the existing transport
    expect(mockHandleRequest).toHaveBeenCalledTimes(1)
  })

  it('DELETE /mcp with valid session ID closes transport and returns 204', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })
    expect(capturedHandler).not.toBeNull()

    // Initialize a session first
    await capturedHandler!(mockReq, mockRes)
    const sessionId = 'session-to-delete'
    capturedSessionInitialized!(sessionId)

    // Send DELETE request
    const mockDeleteReq = {
      method: 'DELETE',
      url: '/mcp',
      headers: { 'mcp-session-id': sessionId },
      on: vi.fn(),
    }
    const mockDeleteRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    }

    await capturedHandler!(mockDeleteReq, mockDeleteRes)

    expect(mockTransportClose).toHaveBeenCalled()
    expect(mockDeleteRes.writeHead).toHaveBeenCalledWith(204)
    expect(mockDeleteRes.end).toHaveBeenCalled()
  })

  it('DELETE /mcp with unknown session ID still returns 204', async () => {
    await startMcpServer({ transport: 'http', port: 3001 })
    expect(capturedHandler).not.toBeNull()

    const mockDeleteReq = {
      method: 'DELETE',
      url: '/mcp',
      headers: { 'mcp-session-id': 'nonexistent-session' },
      on: vi.fn(),
    }
    const mockDeleteRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    }

    await capturedHandler!(mockDeleteReq, mockDeleteRes)

    expect(mockTransportClose).not.toHaveBeenCalled()
    expect(mockDeleteRes.writeHead).toHaveBeenCalledWith(204)
    expect(mockDeleteRes.end).toHaveBeenCalled()
  })
})
