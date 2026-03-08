import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchemaCache, EntitySchemaCacheEntry } from '../schema-cache.js'

function makeEntry(logicalName: string): EntitySchemaCacheEntry {
  return {
    logicalName,
    displayName: logicalName,
    entitySetName: `${logicalName}s`,
    primaryIdAttribute: `${logicalName}id`,
    primaryNameAttribute: 'name',
    attributes: [],
    cachedAt: new Date(),
    ttlMs: 300000,
  }
}

describe('SchemaCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for uncached entities', () => {
    const cache = new SchemaCache()
    expect(cache.get('account')).toBeUndefined()
  })

  it('stores and retrieves entries', () => {
    const cache = new SchemaCache()
    cache.set(makeEntry('account'))
    const entry = cache.get('account')
    expect(entry).toBeDefined()
    expect(entry?.logicalName).toBe('account')
  })

  it('is case-insensitive', () => {
    const cache = new SchemaCache()
    cache.set(makeEntry('account'))
    expect(cache.get('Account')).toBeDefined()
    expect(cache.get('ACCOUNT')).toBeDefined()
  })

  it('expires entries after TTL', () => {
    const cache = new SchemaCache(1000) // 1 second TTL
    cache.set(makeEntry('account'))

    expect(cache.get('account')).toBeDefined()

    vi.advanceTimersByTime(1001)

    expect(cache.get('account')).toBeUndefined()
  })

  it('clears all entries', () => {
    const cache = new SchemaCache()
    cache.set(makeEntry('account'))
    cache.set(makeEntry('contact'))
    cache.clear()
    expect(cache.get('account')).toBeUndefined()
    expect(cache.get('contact')).toBeUndefined()
  })
})
