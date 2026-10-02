import { readFile, writeFile } from 'node:fs/promises'
import type { Score } from '@/src/interfaces'

export type Comparison = {
  status: 'completed' | 'regression'
  baselineMean: number
  skillsMean: number
  delta: number
  cells: number
}

export function compareAddAuth(baseline: Score[], skills: Score[]): Comparison {
  const byKey = (scores: Score[]) => new Map(scores.map((score) => [score.evalKey, score.value]))
  const baselineScores = byKey(baseline)
  const skillsScores = byKey(skills)
  if (
    baselineScores.size !== 4 ||
    skillsScores.size !== 4 ||
    [...baselineScores.keys()].some((key) => !key || !skillsScores.has(key))
  ) {
    throw new Error('Automation failure: expected the same four add-auth variants in both columns')
  }
  const mean = (scores: Map<string | undefined, number>) =>
    [...scores.values()].reduce((sum, score) => sum + score, 0) / scores.size
  const baselineMean = mean(baselineScores)
  const skillsMean = mean(skillsScores)
  const delta = skillsMean - baselineMean
  return {
    status: delta < 0 ? 'regression' : 'completed',
    baselineMean,
    skillsMean,
    delta,
    cells: baselineScores.size,
  }
}

if (import.meta.main) {
  const [baselinePath, skillsPath, outputPath] = process.argv.slice(2)
  if (!baselinePath || !skillsPath || !outputPath) {
    throw new Error('Usage: bun compare-add-auth.ts <baseline.json> <skills.json> <output.json>')
  }
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as Score[]
  const skills = JSON.parse(await readFile(skillsPath, 'utf8')) as Score[]
  const comparison = compareAddAuth(baseline, skills)
  await writeFile(outputPath, JSON.stringify(comparison, null, 2))
  console.log(JSON.stringify(comparison))
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `## Add-auth eval: ${comparison.status}\n\nBaseline: ${(comparison.baselineMean * 100).toFixed(1)}%; Skills: ${(comparison.skillsMean * 100).toFixed(1)}%; delta: ${(comparison.delta * 100).toFixed(1)} points.\n\nA lower Skills score is an eval regression, not an automation failure. Inspect the uploaded scores before acting.\n`
    await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
  }
  if (comparison.status === 'regression') {
    console.warn(
      '::warning::The Skills column scored below baseline; the eval completed successfully.',
    )
  }
}
