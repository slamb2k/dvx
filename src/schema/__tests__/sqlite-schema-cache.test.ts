import { describe, it, expect, afterEach } from 'vitest'
import { unlinkSync } from 'node:fs'
import { SqliteSchemaCache } from '../sqlite-schema-cache.js'
import type { EntitySchemaCacheEntry } from '../schema-cache.js'

const DB_PATH = '/tmp/test-dvx-schema-cache.db'

function makeEntry(logicalName: string): EntitySchemaCacheEntry {
  return {
    logicalName,
    displayName: logicalName,
    entitySetName: `${logicalName}s`,
    primaryIdAttribute: `${logicalName}id`,
    primaryNameAttribute: 'name',
    attributes: [],
    cachedAt: new Date(),
    ttlMs: 300_000,
  }
}

afterEach(() => {
  try { unlinkSync(DB_PATH) } catch { /* ignore */ }
})

describe('SqliteSchemaCache', () => {
  it('set/get returns entry', () => {
    const cache = new SqliteSchemaCache(DB_PATH)
    const entry = makeEntry('account')
    cache.set(entry)
    const result = cache.get('account')
    expect(result).toBeDefined()
    expect(result!.logicalName).toBe('account')
  })

  it('expired entry returns undefined', () => {
    const cache = new SqliteSchemaCache(DB_PATH, 0)
    const entry = makeEntry('account')
    cache.set(entry)
    const result = cache.get('account')
    expect(result).toBeUndefined()
  })

  it('invalidate removes specific entry', () => {
    const cache = new SqliteSchemaCache(DB_PATH)
    cache.set(makeEntry('account'))
    cache.set(makeEntry('contact'))
    cache.invalidate('account')
    expect(cache.get('account')).toBeUndefined()
    expect(cache.get('contact')).toBeDefined()
  })

  it('clear removes all entries', () => {
    const cache = new SqliteSchemaCache(DB_PATH)
    cache.set(makeEntry('account'))
    cache.set(makeEntry('contact'))
    cache.clear()
    expect(cache.get('account')).toBeUndefined()
    expect(cache.get('contact')).toBeUndefined()
  })
})
