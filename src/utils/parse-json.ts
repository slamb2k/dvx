import { ValidationError } from '../errors.js'

export function parseJsonPayload(raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError('Invalid JSON payload')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('JSON payload must be an object')
  }
  return parsed as Record<string, unknown>
}
