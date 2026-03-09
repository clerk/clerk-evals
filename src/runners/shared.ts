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
`

/**
 * Loads the PROMPT.md file from an evaluation directory.
 */
export async function loadPrompt(evalPath: string): Promise<string> {
  return fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')
}

/**
 * Dynamically imports and returns the graders from an evaluation directory.
 */
export async function loadGraders(evalPath: string): Promise<Graders> {
  const graderModule = (await import(path.join(evalPath, 'graders.ts'))) as {
    graders: Graders
  }
  return graderModule.graders
}

/**
 * Runs all graders against a response and returns results as [name, passed] tuples.
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
 */
const MODEL_PRICING: Record<string, [number, number]> = {
  // OpenAI
  'gpt-4o': [2.5, 10],
  'gpt-5': [1.25, 10],
  'gpt-5-chat-latest': [1.25, 10],
  'gpt-5.2': [1.75, 14],
  'gpt-5.2-codex': [1.75, 14],
  'gpt-5.4-2026-03-05': [2.5, 12],
  // Anthropic
  'claude-sonnet-4-0': [3, 15],
  'claude-sonnet-4-5': [3, 15],
  'claude-opus-4-0': [15, 75],
  'claude-opus-4-5': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-haiku-4-5': [1, 5],
  // Google
  'gemini-2.5-flash': [0.15, 0.6],
  'gemini-3-pro-preview': [2, 12],
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
