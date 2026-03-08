import { z } from 'zod'
import { ActionError, DataverseError, EntityNotFoundError, ImpersonationPrivilegeError, RecordNotFoundError } from '../errors.js'
import { AuthManager } from '../auth/auth-manager.js'
import { ISchemaCache, SchemaCache, EntitySchemaCacheEntry, AttributeDefinition } from '../schema/schema-cache.js'
import { withRetry } from '../utils/retry.js'
import { validateEntityName, validateGuid, validateActionName } from '../utils/validation.js'
import { injectPagingCookie } from '../utils/fetchxml.js'

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
  private schemaCache: ISchemaCache
  private baseUrl: string | undefined
  private debug: boolean
  private dryRun: boolean
  private callerObjectId: string | undefined

  constructor(authManager: AuthManager, schemaCache?: ISchemaCache, opts?: { dryRun?: boolean; callerObjectId?: string }) {
    this.authManager = authManager
    this.schemaCache = schemaCache ?? new SchemaCache()
    this.debug = process.env['DVX_DEBUG'] === 'true'
    this.dryRun = opts?.dryRun ?? false
    this.callerObjectId = opts?.callerObjectId
  }

  private async getBaseUrl(): Promise<string> {
    if (this.baseUrl) return this.baseUrl
    const profile = this.authManager.getActiveProfile()
    this.baseUrl = `${profile.environmentUrl}/api/data/v9.2`
    return this.baseUrl
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.authManager.getToken()
    const method = options.method ?? 'GET'
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      ...(options.headers as Record<string, string> ?? {}),
    }

    if (this.callerObjectId) {
      headers['CallerObjectId'] = this.callerObjectId
    }

    if (this.debug) {
      console.error(`[DVX] ${method} ${url}`)
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

      let retryAfterSeconds: number | undefined
      const retryAfterHeader = response.headers.get('Retry-After')
      if (retryAfterHeader) {
        const parsed = Number(retryAfterHeader)
        if (!Number.isNaN(parsed) && parsed > 0) {
          retryAfterSeconds = parsed
        }
      }

      if (response.status === 403 && this.callerObjectId && errorMessage.includes('prvActOnBehalfOfAnotherUser')) {
        throw new ImpersonationPrivilegeError(errorMessage)
      }

      throw new DataverseError(errorMessage, response.status, errorCode, retryAfterSeconds)
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

    let response: Response
    try {
      response = await withRetry(() => this.request(url))
    } catch (e) {
      if (e instanceof DataverseError && e.statusCode === 404) {
        throw new RecordNotFoundError(name, guid)
      }
      throw e
    }

    const json = await response.json() as Record<string, unknown>
    return json
  }

  async createRecord(entityName: string, data: Record<string, unknown>): Promise<string> {
    const name = validateEntityName(entityName)
    const schema = await this.getEntitySchema(name)
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/${schema.entitySetName}`

    if (this.dryRun) {
      console.error(`[DRY RUN] POST ${url}`)
      console.error(`[DRY RUN] Body: ${JSON.stringify(data)}`)
      return 'dry-run'
    }

    const response = await withRetry(() => this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }))

    const entityIdHeader = response.headers.get('OData-EntityId') ?? ''
    const match = /\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/i.exec(entityIdHeader)
    if (!match?.[1]) {
      throw new DataverseError('Create succeeded but OData-EntityId header missing', 201)
    }
    return match[1]
  }

  async updateRecord(entityName: string, id: string, data: Record<string, unknown>): Promise<void> {
    const name = validateEntityName(entityName)
    const guid = validateGuid(id)
    const schema = await this.getEntitySchema(name)
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/${schema.entitySetName}(${guid})`

    if (this.dryRun) {
      console.error(`[DRY RUN] PATCH ${url}`)
      console.error(`[DRY RUN] Body: ${JSON.stringify(data)}`)
      return
    }

    await withRetry(() => this.request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }))
  }

  async deleteRecord(entityName: string, id: string): Promise<void> {
    const name = validateEntityName(entityName)
    const guid = validateGuid(id)
    const schema = await this.getEntitySchema(name)
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/${schema.entitySetName}(${guid})`

    if (this.dryRun) {
      console.error(`[DRY RUN] DELETE ${url}`)
      return
    }

    await withRetry(() => this.request(url, { method: 'DELETE' }))
  }

  async queryFetchXml(
    entityName: string,
    fetchXml: string,
    onRecord?: (record: unknown) => void,
  ): Promise<unknown[]> {
    const name = validateEntityName(entityName)
    const schema = await this.getEntitySchema(name)
    const baseUrl = await this.getBaseUrl()
    const maxRows = Number(process.env['DVX_MAX_ROWS']) || 5000
    let totalRecords = 0
    const records: unknown[] = []
    let page = 1
    let currentXml = fetchXml

    do {
      const encoded = encodeURIComponent(currentXml)
      const url = `${baseUrl}/${schema.entitySetName}?fetchXml=${encoded}`

      const response = await withRetry(() => this.request(url))
      const json = await response.json() as Record<string, unknown>
      const parsed = ODataResponseSchema.parse(json)

      for (const record of parsed.value) {
        if (totalRecords >= maxRows) break
        totalRecords++

        if (onRecord) {
          onRecord(record)
        } else {
          records.push(record)
        }
      }

      if (totalRecords >= maxRows) break

      const cookie = json['@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'] as string | undefined
      if (!cookie) break

      page++
      currentXml = injectPagingCookie(currentXml, cookie, page)
    } while (true)

    return records
  }

  async executeAction(
    actionName: string,
    payload: Record<string, unknown>,
    opts?: { entityName?: string; id?: string },
  ): Promise<Record<string, unknown> | null> {
    validateActionName(actionName)

    const baseUrl = await this.getBaseUrl()
    let url: string
    if (opts?.entityName && opts?.id) {
      const guid = validateGuid(opts.id)
      const schema = await this.getEntitySchema(opts.entityName)
      url = `${baseUrl}/${schema.entitySetName}(${guid})/Microsoft.Dynamics.CRM.${actionName}`
    } else {
      url = `${baseUrl}/${actionName}`
    }

    if (this.dryRun) {
      console.error('[DRY RUN] POST', url)
      console.error('[DRY RUN] Body:', JSON.stringify(payload, null, 2))
      return null
    }

    try {
      return await withRetry(async () => {
        const response = await this.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.status === 204) return null
        const data = await response.json() as unknown
        return z.record(z.string(), z.unknown()).parse(data)
      })
    } catch (err) {
      if (err instanceof DataverseError) {
        throw new ActionError(err.message, err.statusCode)
      }
      throw err
    }
  }

  invalidateSchema(entityName: string): void {
    this.schemaCache.invalidate(entityName)
  }

  clearSchemaCache(): void {
    this.schemaCache.clear()
  }

  async executeBatch(body: string, boundary: string): Promise<string> {
    const baseUrl = await this.getBaseUrl()
    const url = `${baseUrl}/$batch`

    if (this.dryRun) {
      console.error(`[DRY RUN] POST ${url}`)
      console.error(`[DRY RUN] Batch body length: ${body.length}`)
      return ''
    }

    const response = await withRetry(() => this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/mixed;boundary=${boundary}` },
      body,
    }))

    return await response.text()
  }
}
