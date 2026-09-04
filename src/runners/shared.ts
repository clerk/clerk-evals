/**
 * Shared utilities for evaluation runners.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Graders } from '@/src/graders'
import type { Provider } from '@/src/providers'
import { getModel } from '@/src/providers'

/**
 * System prompt for all evaluations.
 * Instructs the model to output all files as fenced code blocks.
 */
export const SYSTEM_PROMPT = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"

\`\`\`

Do not ask clarifying questions. Complete the task with the information provided.
`

async function loadFixtureContext(evalPath: string, variant: string): Promise<string> {
  const fixtureDir = path.join(evalPath, 'fixtures', variant)
  const parts: string[] = []

  async function walk(directory: string, relativeDir = '') {
    let entries: Array<{ name: string; isDirectory(): boolean }>
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.join(relativeDir, entry.name)

      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath)
        continue
      }

      const content = await fs.readFile(absolutePath, 'utf8')
      parts.push(`### ${relativePath}\n\n\`\`\`\n${content}\n\`\`\``)
    }
  }

  await walk(fixtureDir)
  return parts.join('\n\n')
}

/**
 * Loads the PROMPT.md file from an evaluation directory.
 */
export async function loadPrompt(evalPath: string, variant?: string): Promise<string> {
  const prompt = await fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
  if (!variant) return prompt

  const fixtureContext = await loadFixtureContext(evalPath, variant)
  if (!fixtureContext) return prompt

  return `${prompt}\n\n## Project files\n\n${fixtureContext}`
}

/**
 * Dynamically imports and returns the graders from an evaluation directory.
 */
export async function loadGraders(evalPath: string, variant?: string): Promise<Graders> {
  const gradersPath = variant
    ? path.join(evalPath, 'graders', `${variant}.ts`)
    : path.join(evalPath, 'graders.ts')
  const graderModule = (await import(gradersPath)) as {
    graders: Graders
  }
  return graderModule.graders
}

/**
 * Runs all graders against a response and returns results as [name, passed] tuples.
 * Optionally accepts a workDir for filesystem graders bound via bindFilesystemGraders.
 */
export async function runGraders(graders: Graders, response: string): Promise<[string, boolean][]> {
  const results: [string, boolean][] = []
  for (const [key, grader] of Object.entries(graders)) {
    const passed = await grader(response)
    results.push([key, passed])
  }
  return results
}

/**
 * Computes a score (0-1) from grader results.
 */
export function computeScore(graderResults: [string, boolean][]): number {
  return graderResults.filter(([_, isCorrect]) => isCorrect).length / (graderResults.length || 1)
}

/**
 * Resolves a provider/model pair to a language model instance.
 * Returns null if the model is not supported.
 */
export function resolveModel(provider: Provider, model: string) {
  return getModel(provider, model)
}

/**
 * Per-model pricing (USD per 1M tokens): [input, output]
 *
 * Sources:
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 * - Gateway models: https://ai-gateway.vercel.sh/v1/models
 */
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  'gpt-4o': [2.5, 10],
  'gpt-5': [1.25, 10],
  'gpt-5-chat-latest': [1.25, 10],
  'gpt-5.1': [1.25, 10],
  'gpt-5.1-chat-latest': [1.25, 10],
  'gpt-5.1-codex': [1.25, 10],
  'gpt-5.1-codex-max': [1.25, 10],
  'gpt-5.2': [1.75, 14],
  'gpt-5.2-chat-latest': [1.75, 14],
  'gpt-5.2-codex': [1.75, 14],
  'gpt-5.2-pro': [21, 168],
  'gpt-5.3-codex': [1.75, 14],
  'gpt-5.4': [2.5, 12],
  'gpt-5.4-2026-03-05': [2.5, 12],
  'gpt-5.4-mini': [0.75, 4.5],
  'gpt-5.4-nano': [0.2, 1.25],
  'gpt-5.4-pro': [30, 180],
  'gpt-5.5': [5, 30],
  'gpt-5.5-pro': [30, 180],
  'gpt-5.6-sol': [4, 20],
  'gpt-5.6-terra': [2, 12],
  'gpt-5.6-luna': [0.2, 1.2],
  // Anthropic
  'claude-fable-5-1': [10, 50],
  'claude-fable-5': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-4-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-opus-4-5': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-haiku-4-5': [1, 5],
  // Google
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-3.7-flash': [0.75, 3.75],
  'gemini-3.6-flash': [0.75, 3.75],
  'gemini-3.5-flash': [1.5, 9],
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.1-pro-preview': [2, 12],
  'gemini-3.1-flash-lite': [0.25, 1.5],
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-3-pro-preview': [2, 12],
  // Convex leaderboard leaders selected for the default run set
  'grok-4.6': [2, 6],
  'grok-4.5': [2, 6],
  'kimi-k3': [3, 15],
  'hy4-preview': [0.834, 2.501],
}

export function estimateCost(
  model: string,
  usage: { promptTokens: number; completionTokens: number },
): number | undefined {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return undefined
  const [inputRate, outputRate] = pricing
  return (usage.promptTokens * inputRate + usage.completionTokens * outputRate) / 1_000_000
}
