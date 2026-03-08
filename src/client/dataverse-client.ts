import { z } from 'zod'
import { DataverseError, EntityNotFoundError, RecordNotFoundError } from '../errors.js'
import { AuthManager } from '../auth/auth-manager.js'
import { SchemaCache, EntitySchemaCacheEntry, AttributeDefinition } from '../schema/schema-cache.js'
import { withRetry } from '../utils/retry.js'
import { validateEntityName, validateGuid } from '../utils/validation.js'

const ODataResponseSchema = z.object({
  value: z.array(z.record(z.string(), z.unknown())),
  '@odata.nextLink': z.string().optional(),
  '@odata.count': z.number().optional(),
})

const EntityDefinitionSchema = z.object({
  LogicalName: z.string(),
  DisplayName: z.object({
    UserLocalizedLabel: z.object({ Label: z.string() }).nullable().optional(),
  }),
  EntitySetName: z.string(),
  PrimaryIdAttribute: z.string(),
  PrimaryNameAttribute: z.string().nullable(),
})

const EntityListResponseSchema = z.object({
  value: z.array(EntityDefinitionSchema),
})

const SingleEntityDefinitionSchema = EntityDefinitionSchema.extend({
  Attributes: z.array(z.object({
    LogicalName: z.string(),
    DisplayName: z.object({
      UserLocalizedLabel: z.object({ Label: z.string() }).nullable().optional(),
    }),
    AttributeType: z.string(),
    RequiredLevel: z.object({ Value: z.string() }),
    IsCustomAttribute: z.boolean(),
    MaxLength: z.number().optional(),
    Targets: z.array(z.string()).optional(),
  })),
})

interface QueryOptions {
  fields?: string[]
  pageAll?: boolean
  maxRows?: number
  onRecord?: (record: Record<string, unknown>) => void
}

export class DataverseClient {
  private authManager: AuthManager
  private schemaCache: SchemaCache
  private baseUrl: string | undefined
  private debug: boolean

  constructor(authManager: AuthManager, schemaCache?: SchemaCache) {
    this.authManager = authManager
    this.schemaCache = schemaCache ?? new SchemaCache()
    this.debug = process.env['DVX_DEBUG'] === 'true'
  }

  private async getBaseUrl(): Promise<string> {
    if (this.baseUrl) return this.baseUrl
    const profile = this.authManager.getActiveProfile()
    this.baseUrl = `${profile.environmentUrl}/api/data/v9.2`
    return this.baseUrl
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.authManager.getToken()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...(options.headers as Record<string, string> ?? {}),
    }

    if (this.debug) {
      console.error(`[DVX] ${options.method ?? 'GET'} ${url}`)
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      let errorMessage = response.statusText
      let errorCode: string | undefined
      try {
        const body = await response.json() as { error?: { message?: string; code?: string } }
        if (body.error) {
          errorMessage = body.error.message ?? errorMessage
          errorCode = body.error.code
        }
      } catch {
        // ignore parse errors
      }
      throw new DataverseError(errorMessage, response.status, errorCode)
    }

    return response
  }

  async listEntities(): Promise<Array<{ logicalName: string; displayName: string; entitySetName: string }>> {
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/EntityDefinitions?$select=LogicalName,DisplayName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`

    const response = await withRetry(() => this.request(url))
    const json = await response.json()
    const parsed = EntityListResponseSchema.parse(json)

    return parsed.value.map((e) => ({
      logicalName: e.LogicalName,
      displayName: e.DisplayName.UserLocalizedLabel?.Label ?? e.LogicalName,
      entitySetName: e.EntitySetName,
    }))
  }

  async getEntitySchema(entityName: string, noCache = false): Promise<EntitySchemaCacheEntry> {
    const name = validateEntityName(entityName)

    if (!noCache) {
      const cached = this.schemaCache.get(name)
      if (cached) return cached
    }

    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/EntityDefinitions(LogicalName='${name}')?$expand=Attributes($select=LogicalName,DisplayName,AttributeType,RequiredLevel,IsCustomAttribute,MaxLength,Targets)`

    const response = await withRetry(() => this.request(url))
    const json = await response.json()

    let parsed: z.infer<typeof SingleEntityDefinitionSchema>
    try {
      parsed = SingleEntityDefinitionSchema.parse(json)
    } catch {
      throw new EntityNotFoundError(name)
    }

    const entry: EntitySchemaCacheEntry = {
      logicalName: parsed.LogicalName,
      displayName: parsed.DisplayName.UserLocalizedLabel?.Label ?? parsed.LogicalName,
      entitySetName: parsed.EntitySetName,
      primaryIdAttribute: parsed.PrimaryIdAttribute,
      primaryNameAttribute: parsed.PrimaryNameAttribute ?? '',
      attributes: parsed.Attributes.map((a): AttributeDefinition => ({
        logicalName: a.LogicalName,
        displayName: a.DisplayName.UserLocalizedLabel?.Label ?? a.LogicalName,
        attributeType: a.AttributeType,
        requiredLevel: a.RequiredLevel.Value as AttributeDefinition['requiredLevel'],
        isCustomAttribute: a.IsCustomAttribute,
        maxLength: a.MaxLength,
        targets: a.Targets,
      })),
      cachedAt: new Date(),
      ttlMs: 0, // will be set by cache
    }

    this.schemaCache.set(entry)
    return entry
  }

  async query(
    entitySetName: string,
    odata: string,
    options: QueryOptions = {},
  ): Promise<Record<string, unknown>[]> {
    const baseUrl = await this.getBaseUrl()
    const maxRows = options.maxRows ?? (Number(process.env['DVX_MAX_ROWS']) || 5000)
    let totalRecords = 0
    const records: Record<string, unknown>[] = []

    let url = `${baseUrl}/${entitySetName}?${odata}`

    if (options.fields?.length) {
      const separator = odata.includes('$select') ? '' : `&$select=${options.fields.join(',')}`
      if (separator) url += separator
    }

    do {
      const response = await withRetry(() => this.request(url))
      const json = await response.json()
      const parsed = ODataResponseSchema.parse(json)

      for (const record of parsed.value) {
        if (totalRecords >= maxRows) break
        totalRecords++

        if (options.onRecord) {
          options.onRecord(record)
        } else {
          records.push(record)
        }
      }

      if (totalRecords >= maxRows) break
      url = parsed['@odata.nextLink'] ?? ''
    } while (url && options.pageAll)

    return records
  }

  async getRecord(
    entityName: string,
    id: string,
    fields?: string[],
  ): Promise<Record<string, unknown>> {
    const name = validateEntityName(entityName)
    const guid = validateGuid(id)

    // Need entity set name from schema
    const schema = await this.getEntitySchema(name)
    const baseUrl = await this.getBaseUrl()

    let url = `${baseUrl}/${schema.entitySetName}(${guid})`
    if (fields?.length) {
      url += `?$select=${fields.join(',')}`
    }

    const response = await withRetry(() => this.request(url))

    if (response.status === 404) {
      throw new RecordNotFoundError(name, guid)
    }

    const json = await response.json() as Record<string, unknown>
    return json
  }
}
