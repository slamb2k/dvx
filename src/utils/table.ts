export interface TableOptions {
  dimHeaders?: boolean
  showRowCount?: boolean
}

export function renderTable(rows: string[][], headers?: string[], options?: TableOptions): string {
  const allRows = headers ? [headers, ...rows] : rows
  if (allRows.length === 0) return ''

  const colCount = Math.max(...allRows.map((r) => r.length))
  const colWidths: number[] = []

  for (let col = 0; col < colCount; col++) {
    colWidths.push(Math.max(...allRows.map((r) => (r[col] ?? '').length)))
  }

  const lines: string[] = []

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]!
    const formatted = row.map((cell, col) => {
      let display = cell
      if (headers && i === 0 && options?.dimHeaders) {
        display = `\x1b[2m${cell}\x1b[0m`
      }
      if (col === row.length - 1) return display
      return display + ' '.repeat(Math.max(0, (colWidths[col] ?? 0) + 2 - cell.length))
    }).join('')
    lines.push(formatted)

    if (headers && i === 0) {
      lines.push('-'.repeat(colWidths.reduce((sum, w) => sum + w + 2, 0)))
    }
  }

  if (options?.showRowCount) {
    lines.push(`(${rows.length} rows)`)
  }

  return lines.join('\n')
}
