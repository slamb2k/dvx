import { describe, it, expect } from 'vitest'
import { renderTable } from '../table.js'

describe('renderTable', () => {
  it('renders rows with headers and separator', () => {
    const result = renderTable(
      [['alice', '30'], ['bob', '25']],
      ['Name', 'Age'],
    )
    const lines = result.split('\n')
    expect(lines[0]).toContain('Name')
    expect(lines[0]).toContain('Age')
    expect(lines[1]).toMatch(/^-+$/)
    expect(lines[2]).toContain('alice')
    expect(lines[2]).toContain('30')
    expect(lines[3]).toContain('bob')
  })

  it('renders rows without headers', () => {
    const result = renderTable([['a', 'b'], ['c', 'd']])
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('a')
    expect(lines[1]).toContain('d')
  })

  it('pads columns to max width', () => {
    const result = renderTable(
      [['short', 'x'], ['muchlonger', 'y']],
      ['Col1', 'Col2'],
    )
    const lines = result.split('\n')
    // Data rows should have consistent padding
    const dataLine1 = lines[2]!
    const dataLine2 = lines[3]!
    // 'short' should be padded to same width as 'muchlonger'
    expect(dataLine1.indexOf('x')).toBe(dataLine2.indexOf('y'))
  })

  it('returns empty string for empty input', () => {
    expect(renderTable([])).toBe('')
  })

  it('dims headers when dimHeaders is true', () => {
    const result = renderTable(
      [['alice', '30']],
      ['Name', 'Age'],
      { dimHeaders: true },
    )
    expect(result).toContain('\x1b[2m')
    expect(result).toContain('\x1b[0m')
  })

  it('shows row count when showRowCount is true', () => {
    const result = renderTable(
      [['alice', '30'], ['bob', '25']],
      ['Name', 'Age'],
      { showRowCount: true },
    )
    expect(result).toContain('(2 rows)')
  })
})
