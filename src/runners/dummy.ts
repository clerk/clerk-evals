import type { RunnerArgs, RunnerResult } from '@/src/interfaces'
import { ERR, OK } from '@/src/utils/result'

// This is a dummy runner that returns a random score and randomly errors
export default async function dummy(_: RunnerArgs): Promise<RunnerResult> {
  // random error
  if (Math.random() < 0.5) {
    return ERR(new Error('Random error'))
  }

  return OK({
    score: Math.random(),
  })
}

// Run this for one-off testing
// bun run src/runners/dummy.ts
if (import.meta.main) {
  console.log('Running dummy')

  const result = await dummy({
    provider: 'openai',
    model: 'gpt-4o',
    evalPath: new URL('../evals/000-basic-nextjs', import.meta.url).pathname,
  })

  console.log(result)
}
