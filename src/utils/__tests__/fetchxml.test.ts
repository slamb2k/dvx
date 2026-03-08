import { describe, it, expect } from 'vitest'
import { validateFetchXml, injectPagingCookie } from '../fetchxml.js'

describe('validateFetchXml', () => {
  it('accepts valid FetchXML', () => {
    const xml = '<fetch><entity name="account"><attribute name="name"/></entity></fetch>'
    expect(() => validateFetchXml(xml)).not.toThrow()
  })

  it('throws on missing fetch root element', () => {
    const xml = '<query><entity name="account"/></query>'
    expect(() => validateFetchXml(xml)).toThrow('root element must be <fetch>')
  })

  it('throws on invalid XML', () => {
    expect(() => validateFetchXml('<fetch><unclosed')).toThrow('Invalid FetchXML')
  })
})

describe('injectPagingCookie', () => {
  it('injects paging cookie and page into fetch element', () => {
    const xml = '<fetch><entity name="account"><attribute name="name"/></entity></fetch>'
    const cookie = encodeURIComponent('<cookie page="1"><accountid last="123"/></cookie>')
    const result = injectPagingCookie(xml, cookie, 2)

    expect(result).toContain('paging-cookie=')
    expect(result).toContain('page="2"')
    expect(result).toContain('<entity name="account">')
  })
})
