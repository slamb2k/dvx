import { describe, it, expect } from 'vitest'
import { validateGuid, validateEntityName, validateUrl } from '../validation.js'

describe('validateGuid', () => {
  it('accepts valid UUIDs', () => {
    expect(validateGuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('lowercases valid UUIDs', () => {
    expect(validateGuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
  })

  it('rejects invalid GUIDs', () => {
    expect(() => validateGuid('not-a-guid')).toThrow('Invalid GUID')
    expect(() => validateGuid('')).toThrow('Invalid GUID')
    expect(() => validateGuid('a1b2c3d4-e5f6-7890-abcd')).toThrow('Invalid GUID')
  })

  it('rejects GUIDs with dangerous characters', () => {
    expect(() => validateGuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890?foo')).toThrow('Invalid GUID')
  })
})

describe('validateEntityName', () => {
  it('accepts valid entity names', () => {
    expect(validateEntityName('account')).toBe('account')
    expect(validateEntityName('my_custom_entity')).toBe('my_custom_entity')
    expect(validateEntityName('new_field123')).toBe('new_field123')
  })

  it('lowercases entity names', () => {
    expect(validateEntityName('Account')).toBe('account')
  })

  it('rejects names with dangerous characters', () => {
    expect(() => validateEntityName('account?')).toThrow('invalid characters')
    expect(() => validateEntityName('account#foo')).toThrow('invalid characters')
    expect(() => validateEntityName('account%20')).toThrow('invalid characters')
  })

  it('rejects invalid names', () => {
    expect(() => validateEntityName('123entity')).toThrow('Invalid entity')
    expect(() => validateEntityName('')).toThrow('Invalid entity')
    expect(() => validateEntityName('entity name')).toThrow('Invalid entity')
  })
})

describe('validateUrl', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(validateUrl('https://myorg.crm.dynamics.com')).toBe('https://myorg.crm.dynamics.com')
  })

  it('strips trailing paths', () => {
    expect(validateUrl('https://myorg.crm.dynamics.com/api/data')).toBe('https://myorg.crm.dynamics.com')
  })

  it('rejects HTTP URLs', () => {
    expect(() => validateUrl('http://myorg.crm.dynamics.com')).toThrow('HTTPS')
  })

  it('rejects invalid URLs', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid URL')
  })
})
