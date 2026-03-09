export interface ISchemaCache {
  get(entityName: string): EntitySchemaCacheEntry | undefined
  set(entry: EntitySchemaCacheEntry): void
  invalidate(entityName: string): void
  clear(): void
}

export interface AttributeDefinition {
  logicalName: string
  displayName: string
  attributeType: string
  requiredLevel: 'None' | 'SystemRequired' | 'ApplicationRequired' | 'Recommended'
  isCustomAttribute: boolean
  maxLength?: number | undefined
  targets?: string[] | undefined
}

export interface EntitySchemaCacheEntry {
  logicalName: string
  displayName: string
  entitySetName: string
  primaryIdAttribute: string
  primaryNameAttribute: string
  attributes: AttributeDefinition[]
  cachedAt: Date
  ttlMs: number
}

const DEFAULT_TTL_MS = 300_000 // 5 minutes

export class SchemaCache implements ISchemaCache {
  private cache = new Map<string, EntitySchemaCacheEntry>()
  private ttlMs: number

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs ?? (Number(process.env['DVX_SCHEMA_CACHE_TTL_MS']) || DEFAULT_TTL_MS)
  }

  get(entityName: string): EntitySchemaCacheEntry | undefined {
    const entry = this.cache.get(entityName.toLowerCase())
    if (!entry) return undefined

    const age = Date.now() - entry.cachedAt.getTime()
    if (age > entry.ttlMs) {
      this.cache.delete(entityName.toLowerCase())
      return undefined
    }

    return entry
  }

  set(entry: EntitySchemaCacheEntry): void {
    this.cache.set(entry.logicalName.toLowerCase(), {
      ...entry,
      cachedAt: new Date(),
      ttlMs: this.ttlMs,
    })
  }

  invalidate(entityName: string): void {
    this.cache.delete(entityName.toLowerCase())
  }

  clear(): void {
    this.cache.clear()
  }
}
