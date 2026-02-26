import { execSync } from 'node:child_process'
import * as braintrust from 'braintrust'
import type { Score } from '@/src/interfaces'

const DEFAULT_PROJECT = 'clerk-evals'

function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
    return { commit, branch }
  } catch {
    return { commit: 'unknown', branch: 'unknown' }
  }
}

export default async function braintrustReporter(
  scores: Score[],
  runId: string,
  mode: 'baseline' | 'mcp' | 'skills',
) {
  const git = getGitInfo()
  const projectName = process.env.BRAINTRUST_PROJECT || DEFAULT_PROJECT

  const experiment = braintrust.init(projectName, {
    experiment: `${mode}-${git.branch}-${git.commit}`,
    metadata: {
      mode,
      runId,
      gitCommit: git.commit,
      gitBranch: git.branch,
    },
  })

  for (const score of scores) {
    experiment.log({
      input: { model: score.model, framework: score.framework },
      output: { category: score.category },
      scores: { [score.category]: score.value },
      metadata: {
        model: score.model,
        label: score.label,
        framework: score.framework,
        category: score.category,
        mode,
      },
    })
  }

  const summary = await experiment.summarize()
  console.log(`Braintrust experiment: ${summary.experimentUrl}`)
  return summary
}
