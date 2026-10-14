import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Score } from '@/src/interfaces'

export type Comparison = {
  status: 'completed' | 'regression'
  baselineMean: number
  skillsMean: number
  delta: number
  cells: number
}

type SourceRecord = { skills_sha?: string; run_id?: string }

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
  const [baselineDir, skillsDir, outputPath] = process.argv.slice(2)
  if (!baselineDir || !skillsDir || !outputPath) {
    throw new Error('Usage: bun compare-add-auth.ts <baseline-dir> <skills-dir> <output.json>')
  }
  const readJson = async (dir: string, file: string) =>
    JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown
  const comparison = compareAddAuth(
    (await readJson(baselineDir, 'agent-scores.json')) as Score[],
    (await readJson(skillsDir, 'agent-scores.json')) as Score[],
  )
  // Source versions show which run and Skills SHA each column came from, including a reused baseline.
  const baselineSource = (await readJson(baselineDir, 'source-versions.json')) as SourceRecord
  const skillsSource = (await readJson(skillsDir, 'source-versions.json')) as SourceRecord
  const record = { ...comparison, baseline: baselineSource, skills: skillsSource }
  await writeFile(outputPath, JSON.stringify(record, null, 2))
  console.log(JSON.stringify(record))
  if (process.env.GITHUB_STEP_SUMMARY) {
    const reused =
      baselineSource.run_id !== skillsSource.run_id
        ? `Baseline reused from ${baselineSource.skills_sha} (run ${baselineSource.run_id}).\n\n`
        : ''
    const summary = `## Add-auth eval: ${comparison.status}\n\nBaseline: ${(comparison.baselineMean * 100).toFixed(1)}%; Skills: ${(comparison.skillsMean * 100).toFixed(1)}%; delta: ${(comparison.delta * 100).toFixed(1)} points.\n\n${reused}A lower Skills score is an eval regression, not an automation failure. Inspect the uploaded scores before acting.\n`
    await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
  }
  if (comparison.status === 'regression') {
    console.warn(
      '::warning::The Skills column scored below baseline; the eval completed successfully.',
    )
  }
}
