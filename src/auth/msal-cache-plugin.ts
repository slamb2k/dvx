import { ICachePlugin, TokenCacheContext } from '@azure/msal-node'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export class MsalCachePlugin implements ICachePlugin {
  constructor(private readonly cacheFilePath: string) {}

  async beforeCacheAccess(ctx: TokenCacheContext): Promise<void> {
    try {
      const data = readFileSync(this.cacheFilePath, 'utf-8')
      ctx.tokenCache.deserialize(data)
    } catch {
      // File doesn't exist yet — start with empty cache
    }
  }

  async afterCacheAccess(ctx: TokenCacheContext): Promise<void> {
    if (ctx.cacheHasChanged) {
      mkdirSync(dirname(this.cacheFilePath), { recursive: true })
      writeFileSync(this.cacheFilePath, ctx.tokenCache.serialize(), { encoding: 'utf-8', mode: 0o600 })
    }
  }
}
