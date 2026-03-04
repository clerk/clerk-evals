import type { Score } from '@/src/interfaces'

const isTTY = process.stdout.isTTY ?? false

const colors = {
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red: isTTY ? '\x1b[31m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  reset: isTTY ? '\x1b[0m' : '',
  bold: isTTY ? '\x1b[1m' : '',
}

function colorize(value: number): string {
  const pct = `${(value * 100).toFixed(0)}%`
  if (value >= 0.8) return `${colors.green}${pct}${colors.reset}`
  if (value >= 0.5) return `${colors.yellow}${pct}${colors.reset}`
  return `${colors.red}${pct}${colors.reset}`
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes are intentional
const ANSI_RE = /\x1b\[[0-9;]*m/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '')
}

function pad(str: string, len: number): string {
  const visible = stripAnsi(str)
  const padding = Math.max(0, len - visible.length)
  return str + ' '.repeat(padding)
}

export default function consoleReporter(scores: Score[]) {
  if (scores.length === 0) {
    console.log('No scores to report.')
    return
  }

  // Group by category and model
  const categories = [...new Set(scores.map((s) => s.category))]
  const models = [...new Set(scores.map((s) => s.label))]

  // Build score matrix: category -> model -> avg score
  const matrix = new Map<string, Map<string, number[]>>()
  for (const cat of categories) {
    matrix.set(cat, new Map())
    for (const model of models) {
      matrix.get(cat)?.set(model, [])
    }
  }
  for (const score of scores) {
    matrix.get(score.category)?.get(score.label)?.push(score.value)
  }

  // Column widths
  const catWidth = Math.max(12, ...categories.map((c) => c.length))
  const colWidth = Math.max(8, ...models.map((m) => m.length))

  // Header
  const header = `${pad('Category', catWidth)} ${models.map((m) => pad(m, colWidth)).join(' ')}`
  const separator = `${colors.dim}${'─'.repeat(stripAnsi(header).length)}${colors.reset}`

  console.log()
  console.log(`${colors.bold}${header}${colors.reset}`)
  console.log(separator)

  // Model totals for averages
  const modelTotals = new Map<string, number[]>()
  for (const model of models) {
    modelTotals.set(model, [])
  }

  // Rows
  for (const cat of categories) {
    const cols = models.map((model) => {
      const values = matrix.get(cat)?.get(model) ?? []
      if (values.length === 0) return pad(`${colors.dim}  -${colors.reset}`, colWidth)
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      modelTotals.get(model)?.push(avg)
      return pad(colorize(avg), colWidth)
    })
    console.log(`${pad(cat, catWidth)} ${cols.join(' ')}`)
  }

  // Average row
  console.log(separator)
  const avgCols = models.map((model) => {
    const values = modelTotals.get(model) ?? []
    if (values.length === 0) return pad('-', colWidth)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    return pad(colorize(avg), colWidth)
  })
  console.log(`${colors.bold}${pad('Average', catWidth)}${colors.reset} ${avgCols.join(' ')}`)
  console.log()
}
