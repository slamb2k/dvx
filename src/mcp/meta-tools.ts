import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { DataverseClient } from '../client/dataverse-client.js'
import { buildBatchBody, type BatchOperation } from '../utils/batch-builder.js'
import { ValidationError } from '../errors.js'

export function getMetaToolDefinitions(): Tool[] {
  return [
    {
      name: 'discover_entity',
      description: 'Fetch schema for a Dataverse entity by logical name',
      inputSchema: {
        type: 'object',
        properties: {
          entity_name: { type: 'string', description: 'Logical name of the entity' },
        },
        required: ['entity_name'],
      },
    },
    {
      name: 'list_entities',
      description: 'List all Dataverse entity logical names',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'execute_query',
      description: 'Execute an OData or FetchXML query against Dataverse',
      inputSchema: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Entity logical name (required for fetchxml)' },
          odata: { type: 'string', description: 'OData query string (entitySetName?$filter=...)' },
          fetchxml: { type: 'string', description: 'FetchXML query string' },
        },
      },
    },
    {
      name: 'execute_action',
      description: 'Execute a Dataverse custom action or SDK message',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Action name (PascalCase)' },
          payload: { type: 'object', description: 'Action input parameters' },
          entity: { type: 'string', description: 'Entity logical name for bound actions' },
          id: { type: 'string', description: 'Record GUID for bound actions' },
        },
        required: ['name', 'payload'],
      },
    },
    {
      name: 'batch_execute',
      description: 'Execute multiple Dataverse operations in a single batch request',
      inputSchema: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'] },
                path: { type: 'string' },
                body: { type: 'object' },
              },
              required: ['method', 'path'],
            },
          },
          atomic: { type: 'boolean', description: 'Wrap in changeset for transactional semantics' },
        },
        required: ['operations'],
      },
    },
  ]
}

export async function handleMetaTool(
  name: string,
  args: Record<string, unknown>,
  client: DataverseClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  let result: unknown

  switch (name) {
    case 'discover_entity': {
      result = await client.getEntitySchema(args['entity_name'] as string)
      break
    }
    case 'list_entities': {
      result = await client.listEntities()
      break
    }
    case 'execute_query': {
      if (args['odata']) {
        const odata = args['odata'] as string
        const qIndex = odata.indexOf('?')
        const entitySetName = qIndex >= 0 ? odata.slice(0, qIndex) : odata
        const queryString = qIndex >= 0 ? odata.slice(qIndex + 1) : ''
        result = await client.query(entitySetName, queryString, { pageAll: true })
      } else if (args['fetchxml']) {
        if (!args['entity']) throw new ValidationError('entity is required for fetchxml queries')
        const entityName = args['entity'] as string
        const records: unknown[] = []
        await client.queryFetchXml(entityName, args['fetchxml'] as string, (record) => {
          records.push(record)
        })
        result = records
      } else {
        throw new ValidationError('Either odata or fetchxml must be provided')
      }
      break
    }
    case 'execute_action': {
      result = await client.executeAction(
        args['name'] as string,
        (args['payload'] ?? {}) as Record<string, unknown>,
        { entityName: args['entity'] as string | undefined, id: args['id'] as string | undefined },
      )
      break
    }
    case 'batch_execute': {
      const operations = args['operations'] as BatchOperation[]
      const atomic = Boolean(args['atomic'])
      const boundary = `batch_dvx_mcp_${Date.now()}`
      const body = buildBatchBody(operations, boundary, { atomic })
      result = await client.executeBatch(body, boundary)
      break
    }
    default:
      throw new ValidationError(`Unknown meta-tool: ${name}`)
  }

  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
}
