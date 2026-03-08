import { XMLParser } from 'fast-xml-parser'
import { FetchXmlValidationError } from '../errors.js'

const parser = new XMLParser({ ignoreAttributes: false })

export function validateFetchXml(xml: string): void {
  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xml) as Record<string, unknown>
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    throw new FetchXmlValidationError(`Invalid FetchXML: ${message}`)
  }

  if (!parsed['fetch']) {
    throw new FetchXmlValidationError('Invalid FetchXML: root element must be <fetch>')
  }
}

export function injectPagingCookie(xml: string, cookie: string, page: number): string {
  const decoded = decodeURIComponent(cookie)
  // Strip existing paging-cookie and page attributes before injecting new ones
  const cleaned = xml.replace(/<fetch([^>]*)>/, (_match, attrs: string) => {
    const stripped = attrs
      .replace(/\s+paging-cookie="[^"]*"/g, '')
      .replace(/\s+page="[^"]*"/g, '')
    return `<fetch${stripped}>`
  })
  return cleaned.replace(
    /<fetch/,
    `<fetch paging-cookie="${decoded.replace(/"/g, '&quot;')}" page="${page}"`,
  )
}
