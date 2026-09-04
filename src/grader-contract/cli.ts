import path from 'node:path'
import { parseArgs } from 'node:util'
import { runGraderContract } from './index'
import { formatGraderContractReport } from './report'

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    eval: { type: 'string', short: 'e' },
  },
  strict: true,
  allowPositionals: true,
})

if (!values.eval) {
  console.error('Error: --eval is required')
  process.exit(1)
}

const normalizedEval = values.eval.replace(/^\.\//, '').replace(/^evals\//, '')
const evalPath = path.resolve(process.cwd(), 'src', 'evals', normalizedEval)

try {
  const report = await runGraderContract({ evalPath })
  console.log(formatGraderContractReport(report))
  if (!report.passed) process.exitCode = 1
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
