import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { resolveAgentConfig } from '@/src/agent-config'
import { EVALUATIONS, getAllModels } from '@/src/config'
import { getEvalKey } from '@/src/eval-identity'
import { getAllAgentTypes } from '@/src/interfaces'
import { estimateCost } from '@/src/runners/shared'

type AuditResult = {
  errors: string[]
  warnings: string[]
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findPromptDirectories(root: string, relativeDir = ''): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const directories: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name)
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      directories.push(...(await findPromptDirectories(absolutePath, relativePath)))
    } else if (entry.name === 'PROMPT.md') {
      directories.push(`evals/${relativeDir}`)
    }
  }
  return directories
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

export async function auditSuite(cwd = process.cwd()): Promise<AuditResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const models = getAllModels()

  for (const value of duplicates(models.map((model) => `${model.provider}/${model.name}`))) {
    errors.push(`Duplicate model ID: ${value}`)
  }
  for (const value of duplicates(models.map((model) => `${model.provider}/${model.label}`))) {
    errors.push(`Duplicate model label: ${value}`)
  }
  for (const model of models) {
    if (!estimateCost(model.name, { promptTokens: 1, completionTokens: 1 })) {
      warnings.push(`Missing pricing: ${model.provider}/${model.name}`)
    }
  }

  const evalKeys = EVALUATIONS.map(getEvalKey)
  for (const value of duplicates(evalKeys)) errors.push(`Duplicate evaluation: ${value}`)

  for (const evaluation of EVALUATIONS) {
    const evalDir = path.join(cwd, 'src', evaluation.path)
    if (!(await exists(path.join(evalDir, 'PROMPT.md')))) {
      errors.push(`Missing prompt: ${getEvalKey(evaluation)}`)
    }

    const gradersPath = evaluation.variant
      ? path.join(evalDir, 'graders', `${evaluation.variant}.ts`)
      : path.join(evalDir, 'graders.ts')
    if (!(await exists(gradersPath))) errors.push(`Missing graders: ${getEvalKey(evaluation)}`)

    if (evaluation.agent) {
      try {
        await resolveAgentConfig(evalDir, evaluation.agent)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${getEvalKey(evaluation)}: ${message}`)
      }
    }
  }

  const registeredPaths = new Set(EVALUATIONS.map((evaluation) => evaluation.path))
  const evalRoot = path.join(cwd, 'src', 'evals')
  for (const promptDir of await findPromptDirectories(evalRoot)) {
    if (promptDir === 'evals/_template') continue
    if (!registeredPaths.has(promptDir)) warnings.push(`Unregistered prompt: ${promptDir}`)
  }

  for (const agent of getAllAgentTypes()) {
    if (!(await exists(path.join(cwd, 'src', 'runners', 'agents', `${agent}.ts`)))) {
      errors.push(`Missing agent runner: ${agent}`)
    }
  }

  return { errors, warnings }
}

if (import.meta.main) {
  const result = await auditSuite()
  console.log(
    `Suite: ${getAllModels().length} models, ${EVALUATIONS.length} tasks, ${EVALUATIONS.filter((evaluation) => evaluation.agent).length} agent tasks`,
  )
  for (const warning of result.warnings) console.warn(`WARN ${warning}`)
  for (const error of result.errors) console.error(`ERROR ${error}`)
  if (result.errors.length > 0) process.exit(1)
}
