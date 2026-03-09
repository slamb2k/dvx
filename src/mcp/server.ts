import { randomUUID } from 'node:crypto'
import { text } from 'node:stream/consumers'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '../client/create-client.js'
import { getMetaToolDefinitions, handleMetaTool } from './meta-tools.js'
import { buildEntityToolDefinitions, handleEntityTool, ENTITY_TOOL_PREFIXES } from './dynamic-tools.js'
import { ValidationError } from '../errors.js'

const META_TOOL_NAMES = new Set(['discover_entity', 'list_entities', 'execute_query', 'execute_action', 'batch_execute'])

async function parseBody(req: import('node:http').IncomingMessage): Promise<unknown> {
  try {
    const body = await text(req)
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function createMcpServer(
  client: Awaited<ReturnType<typeof createClient>>['client'],
  entitySchemas: Awaited<ReturnType<typeof client.getEntitySchema>>[],
): Server {
  const server = new Server(
    { name: 'dvx', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  const { tools: entityTools, entitySetMap } = buildEntityToolDefinitions(entitySchemas)
  const allTools = [
    ...getMetaToolDefinitions(),
    ...entityTools,
  ]

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const safeArgs = (args ?? {}) as Record<string, unknown>

    if (META_TOOL_NAMES.has(name)) {
      return handleMetaTool(name, safeArgs, client)
    }

    if (ENTITY_TOOL_PREFIXES.some((p) => name.startsWith(p))) {
      return handleEntityTool(name, safeArgs, client, entitySetMap)
    }

    throw new ValidationError(`Unknown tool: ${name}`)
  })

  return server
}

export async function startMcpServer(opts: { entities?: string[]; transport?: 'stdio' | 'http'; port?: number }): Promise<void> {
  const { client } = await createClient()

  const entitySchemas = opts.entities
    ? await Promise.all(opts.entities.map((e) => client.getEntitySchema(e)))
    : []

  if (opts.transport === 'http') {
    const { createServer } = await import('node:http')
    const port = opts.port ?? 3000

    const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: Server }>()

    const httpServer = createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (req.method === 'DELETE' && req.url === '/mcp') {
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!
          await session.transport.close()
          sessions.delete(sessionId)
        }
        res.writeHead(204)
        res.end()
        return
      }

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!
        await session.transport.handleRequest(req, res, await parseBody(req))
        return
      }

      // Initialization path: create a new Server and transport for this session
      const mcpServer = createMcpServer(client, entitySchemas)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport, server: mcpServer })
        },
        onsessionclosed: (sid) => {
          sessions.delete(sid)
        },
      })

      // Type assertion needed: StreamableHTTPServerTransport's optional callback
      // properties are not compatible with Transport under exactOptionalPropertyTypes
      await mcpServer.connect(transport as Parameters<typeof mcpServer.connect>[0])
      await transport.handleRequest(req, res, await parseBody(req))
    })

    httpServer.listen(port, () => {
      console.error(`dvx MCP HTTP server listening on port ${port}`)
      console.error('Stateful session mode — SSE subscriptions and batch progress streaming are supported.')
    })
    return
  }

  // stdio (existing path)
  const server = createMcpServer(client, entitySchemas)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
