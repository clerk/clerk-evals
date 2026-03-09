import { execSync } from 'node:child_process'
import * as braintrust from 'braintrust'
import type { RunnerDebugPayload, Score } from '@/src/interfaces'

const DEFAULT_PROJECT = 'openfort-evals'

export type BraintrustEntry = Score & {
  evaluationPath: string
  debug?: RunnerDebugPayload
}

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
  entries: BraintrustEntry[],
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

  for (const entry of entries) {
    const graderScores: Record<string, number> = {}
    if (entry.debug?.graders) {
      for (const [name, passed] of entry.debug.graders) {
        graderScores[name] = passed ? 1 : 0
      }
    }

    experiment.log({
      input: {
        prompt: entry.debug?.prompt,
        model: entry.model,
        framework: entry.framework,
        evaluationPath: entry.evaluationPath,
      },
      output: {
        response: entry.debug?.response,
        category: entry.category,
      },
      scores: {
        overall: entry.value,
        ...graderScores,
      },
      metrics: {
        ...(entry.durationMs != null && { durationMs: entry.durationMs }),
        ...(entry.tokens != null && {
          promptTokens: entry.tokens.promptTokens,
          completionTokens: entry.tokens.completionTokens,
          totalTokens: entry.tokens.totalTokens,
        }),
        ...(entry.costUsd != null && { costUsd: entry.costUsd }),
      },
      metadata: {
        model: entry.model,
        label: entry.label,
        framework: entry.framework,
        category: entry.category,
        evaluationPath: entry.evaluationPath,
        mode,
        toolCallCount: entry.debug?.toolCalls?.length ?? 0,
        toolsUsed: [...new Set(entry.debug?.toolCalls?.map((tc) => tc.toolName))],
      },
      tags: [mode, entry.category, entry.framework],
    })
  }

  const summary = await experiment.summarize()
  console.log(`Braintrust experiment: ${summary.experimentUrl}`)
  return summary
}
