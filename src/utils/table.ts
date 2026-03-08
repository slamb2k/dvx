export function renderTable(rows: string[][], headers?: string[]): string {
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
      // Don't pad the last column
      if (col === row.length - 1) return cell
      return cell.padEnd((colWidths[col] ?? 0) + 2)
    }).join('')
    lines.push(formatted)

    // Add separator after header row
    if (headers && i === 0) {
      lines.push('-'.repeat(colWidths.reduce((sum, w) => sum + w + 2, 0)))
    }
  }

  return lines.join('\n')
}
