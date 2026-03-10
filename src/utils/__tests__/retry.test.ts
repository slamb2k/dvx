import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../retry.js'
import { DataverseError } from '../../errors.js'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { baseDelayMs: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DataverseError('rate limited', 429))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 server error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DataverseError('server error', 500))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 400 client error', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new DataverseError('bad request', 400))

    await expect(withRetry(fn, { baseDelayMs: 1, maxRetries: 3 }))
      .rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry on non-DataverseError', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new Error('generic error'))

    await expect(withRetry(fn, { baseDelayMs: 1, maxRetries: 3 }))
      .rejects.toThrow('generic error')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new DataverseError('rate limited', 429))

    await expect(withRetry(fn, { baseDelayMs: 1, maxRetries: 2 }))
      .rejects.toThrow('rate limited')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('applies exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DataverseError('rate limited', 429))
      .mockRejectedValueOnce(new DataverseError('rate limited', 429))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('uses Retry-After header value when present on 429', async () => {
    const error = new DataverseError('rate limited', 429, undefined, 2)
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok')

    const start = Date.now()
    const result = await withRetry(fn, { baseDelayMs: 100, maxRetries: 3 })
    const elapsed = Date.now() - start

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    // Retry-After is 2 seconds = 2000ms; should wait ~2000ms, not 100ms (base delay)
    expect(elapsed).toBeGreaterThanOrEqual(1500)
  })

  it('caps Retry-After delay at maxDelayMs', async () => {
    const error = new DataverseError('rate limited', 429, undefined, 60)
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok')

    const start = Date.now()
    const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3, maxDelayMs: 50 })
    const elapsed = Date.now() - start

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
    // Should be capped at 50ms, not 60000ms
    expect(elapsed).toBeLessThan(500)
  })

  it('calls onRetry callback before retrying', async () => {
    const onRetry = vi.fn()
    const fn = vi.fn()
      .mockRejectedValueOnce(new DataverseError('rate limited', 429))
      .mockResolvedValue('ok')

    await withRetry(fn, { baseDelayMs: 1, maxRetries: 3, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(DataverseError))
  })
})
