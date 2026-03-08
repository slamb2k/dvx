import { ValidationError } from '../errors.js'

export function parseJsonPayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    throw new ValidationError('Invalid JSON payload')
  }
}
