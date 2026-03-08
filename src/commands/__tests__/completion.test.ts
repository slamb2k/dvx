import { describe, it, expect, vi, beforeEach } from 'vitest'
import { completion } from '../completion.js'

describe('completion', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('bash: outputs script containing dvx and _dvx_completion', () => {
    completion('bash')

    const output = vi.mocked(console.log).mock.calls[0]![0] as string
    expect(output).toContain('dvx')
    expect(output).toContain('_dvx_completion')
    expect(output).toContain('complete -F _dvx_completion dvx')
  })

  it('zsh: outputs script containing #compdef dvx', () => {
    completion('zsh')

    const output = vi.mocked(console.log).mock.calls[0]![0] as string
    expect(output).toContain('#compdef dvx')
    expect(output).toContain('_dvx')
  })

  it('powershell: outputs script containing Register-ArgumentCompleter', () => {
    completion('powershell')

    const output = vi.mocked(console.log).mock.calls[0]![0] as string
    expect(output).toContain('Register-ArgumentCompleter')
    expect(output).toContain('dvx')
  })

  it('bash: includes all known commands', () => {
    completion('bash')

    const output = vi.mocked(console.log).mock.calls[0]![0] as string
    expect(output).toContain('entities')
    expect(output).toContain('schema')
    expect(output).toContain('query')
    expect(output).toContain('create')
    expect(output).toContain('init')
    expect(output).toContain('completion')
  })
})
