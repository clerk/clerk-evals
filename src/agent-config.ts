import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  AgentEvaluationConfig,
  Evaluation,
  ResolvedAgentEvaluationConfig,
} from '@/src/interfaces'

export function isAgentEvaluation(
  evaluation: Evaluation,
): evaluation is Evaluation & { agent: AgentEvaluationConfig } {
  return evaluation.agent !== undefined
}

async function resolveEvalAssetDirectory(
  evalDir: string,
  relativePath: string,
  label: string,
): Promise<string> {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Agent asset path must be eval-relative: ${relativePath}`)
  }

  const root = path.resolve(evalDir)
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Agent asset path escapes eval directory: ${relativePath}`)
  }

  let realRoot: string
  let realTarget: string
  try {
    const realPaths = await Promise.all([realpath(root), realpath(resolved)])
    realRoot = realPaths[0]
    realTarget = realPaths[1]
  } catch {
    throw new Error(`Agent ${label} directory does not exist: ${relativePath}`)
  }

  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error(`Agent asset path escapes eval directory through a symlink: ${relativePath}`)
  }
  if (!(await stat(realTarget)).isDirectory()) {
    throw new Error(`Agent ${label} path is not a directory: ${relativePath}`)
  }

  return realTarget
}

export async function resolveAgentConfig(
  evalDir: string,
  config: AgentEvaluationConfig,
): Promise<ResolvedAgentEvaluationConfig> {
  return {
    workspacePath: await resolveEvalAssetDirectory(evalDir, config.workspacePath, 'workspace'),
    verification: config.verification
      ? {
          testsPath: await resolveEvalAssetDirectory(
            evalDir,
            config.verification.testsPath,
            'hidden verification',
          ),
        }
      : undefined,
  }
}
