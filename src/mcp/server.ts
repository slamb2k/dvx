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

    const httpServer = createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      // stateless: fresh Server instance per request to avoid connect() state corruption
      const server = createMcpServer(client, entitySchemas)

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      })

      res.on('close', () => void transport.close())

      await server.connect(transport)
      await transport.handleRequest(req, res, await parseBody(req))
    })

    httpServer.listen(port, () => {
      console.error(`dvx MCP HTTP server listening on port ${port}`)
      console.error('Stateless mode. For stateful session support (better performance with batch tools), see: https://github.com/slamb2k/dvx#mcp-stateful')
    })
    return
  }

  // stdio (existing path)
  const server = createMcpServer(client, entitySchemas)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
