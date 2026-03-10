import { describe, it, expect, beforeEach } from 'vitest'
import { setUxOptions, getUxOptions, isInteractive, createSpinner, stripAnsi } from '../cli.js'

describe('cli utils', () => {
  beforeEach(() => {
    setUxOptions({ quiet: false, noColor: false })
  })

  it('setUxOptions/getUxOptions roundtrip', () => {
    setUxOptions({ quiet: true, noColor: true })
    expect(getUxOptions()).toEqual({ quiet: true, noColor: true })
  })

  it('isInteractive returns false when quiet', () => {
    setUxOptions({ quiet: true, noColor: false })
    expect(isInteractive()).toBe(false)
  })

  it('createSpinner returns no-op when not interactive', () => {
    setUxOptions({ quiet: true, noColor: false })
    const s = createSpinner()
    // Should not throw
    s.start('test')
    s.message('update')
    s.stop('done')
    s.error('fail')
  })

  it('stripAnsi removes ANSI escape codes', () => {
    expect(stripAnsi('\x1b[36mhello\x1b[0m')).toBe('hello')
    expect(stripAnsi('\x1b[2mfaded\x1b[0m text')).toBe('faded text')
    expect(stripAnsi('plain')).toBe('plain')
  })
})
