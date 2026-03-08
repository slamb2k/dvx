import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { DataverseClient } from '../client/dataverse-client.js'
import type { EntitySchemaCacheEntry } from '../schema/schema-cache.js'
import { ValidationError } from '../errors.js'

export const ENTITY_TOOL_PREFIXES = ['create_', 'update_', 'get_', 'query_'] as const

export function buildEntityToolDefinitions(schemas: EntitySchemaCacheEntry[]): {
  tools: Tool[]
  entitySetMap: Map<string, string>
} {
  const tools: Tool[] = []
  const entitySetMap = new Map<string, string>()
  for (const schema of schemas) {
    const { logicalName, entitySetName, attributes } = schema

    entitySetMap.set(logicalName, entitySetName)

    const attrProps: Record<string, { type: string; description?: string }> = {}
    for (const attr of attributes) {
      attrProps[attr.logicalName] = { type: 'string', description: attr.displayName }
    }

    tools.push(
      {
        name: `create_${logicalName}`,
        description: `Create a new ${logicalName} record`,
        inputSchema: { type: 'object', properties: attrProps },
      },
      {
        name: `update_${logicalName}`,
        description: `Update an existing ${logicalName} record`,
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Record GUID' }, ...attrProps },
          required: ['id'],
        },
      },
      {
        name: `get_${logicalName}`,
        description: `Get a ${logicalName} record by ID`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Record GUID' },
            fields: { type: 'string', description: 'Comma-separated field names' },
          },
          required: ['id'],
        },
      },
      {
        name: `query_${logicalName}`,
        description: `Query ${logicalName} records with OData filter`,
        inputSchema: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'OData filter expression' },
            fields: { type: 'string', description: 'Comma-separated field names' },
            top: { type: 'number', description: 'Max records to return' },
          },
        },
      },
    )
  }
  return { tools, entitySetMap }
}

export async function handleEntityTool(
  name: string,
  args: Record<string, unknown>,
  client: DataverseClient,
  entitySetMap?: Map<string, string>,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const prefixes = [...ENTITY_TOOL_PREFIXES]
  const prefix = prefixes.find((p) => name.startsWith(p))
  if (!prefix) throw new ValidationError(`Unknown entity tool: ${name}`)

  const entityName = name.slice(prefix.length)
  let result: unknown

  switch (prefix) {
    case 'create_': {
      result = await client.createRecord(entityName, args as Record<string, unknown>)
      break
    }
    case 'update_': {
      const { id, ...payload } = args
      result = await client.updateRecord(entityName, id as string, payload as Record<string, unknown>)
      break
    }
    case 'get_': {
      const fields = (args['fields'] as string | undefined)?.split(',').map((f) => f.trim())
      result = await client.getRecord(entityName, args['id'] as string, fields)
      break
    }
    case 'query_': {
      const resolvedEntitySetName = entitySetMap?.get(entityName)
        ?? (await client.getEntitySchema(entityName)).entitySetName
      const parts: string[] = []
      if (args['filter']) parts.push(`$filter=${args['filter'] as string}`)
      if (args['fields']) parts.push(`$select=${args['fields'] as string}`)
      if (args['top']) parts.push(`$top=${args['top'] as number}`)
      const queryString = parts.join('&')
      result = await client.query(resolvedEntitySetName, queryString, { pageAll: true })
      break
    }
  }

  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
}
