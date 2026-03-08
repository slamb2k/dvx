import { DataverseError } from '../errors.js'

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxRetries) break

      // Only retry on 429 (rate limited) or 5xx (server errors)
      if (error instanceof DataverseError) {
        if (error.statusCode === 429 || error.statusCode >= 500) {
          // Use Retry-After header value if available, otherwise exponential backoff
          const delay = error.retryAfterSeconds
            ? Math.min(error.retryAfterSeconds * 1000, opts.maxDelayMs)
            : Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs)
          await sleep(delay)
          continue
        }
      }

      // Don't retry other errors
      throw error
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
