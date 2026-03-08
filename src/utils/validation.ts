import { ValidationError } from '../errors.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ENTITY_NAME_REGEX = /^[a-z][a-z0-9_]*$/i
const DANGEROUS_CHARS = /[?#%]/

export function validateGuid(value: string, label = 'ID'): string {
  if (!UUID_REGEX.test(value)) {
    throw new ValidationError(`Invalid GUID for ${label}: '${value}'`)
  }
  return value.toLowerCase()
}

export function validateEntityName(name: string): string {
  if (DANGEROUS_CHARS.test(name)) {
    throw new ValidationError(`Entity name contains invalid characters: '${name}'`)
  }
  if (!ENTITY_NAME_REGEX.test(name)) {
    throw new ValidationError(`Invalid entity logical name: '${name}'`)
  }
  return name.toLowerCase()
}

export function validateUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') {
      throw new ValidationError(`Environment URL must use HTTPS: '${url}'`)
    }
    return parsed.origin
  } catch (e) {
    if (e instanceof ValidationError) throw e
    throw new ValidationError(`Invalid URL: '${url}'`)
  }
}
