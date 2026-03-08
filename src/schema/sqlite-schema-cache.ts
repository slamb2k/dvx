import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ISchemaCache, EntitySchemaCacheEntry } from './schema-cache.js'

export class SqliteSchemaCache implements ISchemaCache {
  private db: Database.Database
  private ttlMs: number

  constructor(dbPath: string, ttlMs = 300_000) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.ttlMs = ttlMs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_cache (
        logical_name TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        ttl_ms INTEGER NOT NULL
      )
    `)
  }

  get(entityName: string): EntitySchemaCacheEntry | undefined {
    const row = this.db.prepare(
      'SELECT data, cached_at, ttl_ms FROM schema_cache WHERE logical_name = ?'
    ).get(entityName.toLowerCase()) as { data: string; cached_at: number; ttl_ms: number } | undefined
    if (!row) return undefined
    if (Date.now() - row.cached_at > row.ttl_ms) {
      this.db.prepare('DELETE FROM schema_cache WHERE logical_name = ?').run(entityName.toLowerCase())
      return undefined
    }
    const entry = JSON.parse(row.data) as EntitySchemaCacheEntry
    entry.cachedAt = new Date(entry.cachedAt)
    return entry
  }

  set(entry: EntitySchemaCacheEntry): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO schema_cache (logical_name, data, cached_at, ttl_ms) VALUES (?, ?, ?, ?)'
    ).run(entry.logicalName.toLowerCase(), JSON.stringify(entry), Date.now(), this.ttlMs)
  }

  invalidate(entityName: string): void {
    this.db.prepare('DELETE FROM schema_cache WHERE logical_name = ?').run(entityName.toLowerCase())
  }

  clear(): void {
    this.db.prepare('DELETE FROM schema_cache').run()
  }
}
