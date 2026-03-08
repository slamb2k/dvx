import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '../client/create-client.js'
import { getMetaToolDefinitions, handleMetaTool } from './meta-tools.js'
import { buildEntityToolDefinitions, handleEntityTool } from './dynamic-tools.js'
import { ValidationError } from '../errors.js'

const META_TOOL_NAMES = new Set(['discover_entity', 'list_entities', 'execute_query', 'execute_action', 'batch_execute'])

export async function startMcpServer(opts: { entities?: string[] }): Promise<void> {
  const { client } = await createClient()

  const entitySchemas = opts.entities
    ? await Promise.all(opts.entities.map((e) => client.getEntitySchema(e)))
    : []

  const server = new Server(
    { name: 'dvx', version: '0.1.0' },
    { capabilities: { tools: {} } },
  )

  const allTools = [
    ...getMetaToolDefinitions(),
    ...buildEntityToolDefinitions(entitySchemas),
  ]

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const safeArgs = (args ?? {}) as Record<string, unknown>

    if (META_TOOL_NAMES.has(name)) {
      return handleMetaTool(name, safeArgs, client)
    }

    const knownPrefixes = ['create_', 'update_', 'get_', 'query_']
    if (knownPrefixes.some((p) => name.startsWith(p))) {
      return handleEntityTool(name, safeArgs, client)
    }

    throw new ValidationError(`Unknown tool: ${name}`)
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
