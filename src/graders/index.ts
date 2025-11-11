import { type LLMJudgeConfig, makeScorer } from '@/src/scorers/llm'

type Grader = (input: string) => Promise<boolean>
export type Graders = Record<string, Grader>

type ContainsOptions = {
  /** Defaults to case-insensitive matching */
  caseSensitive?: boolean
}

export const defineGraders = <T extends Graders>(graders: T) => graders

export const contains = (needle: string, options: ContainsOptions = {}) => {
  const normalizedNeedle = options.caseSensitive ? needle : needle.toLowerCase()

  return async (actual: string) => {
    const haystack = options.caseSensitive ? actual : actual.toLowerCase()
    return haystack.includes(normalizedNeedle)
  }
}

export const containsAny = (needles: string[], options: ContainsOptions = {}) => {
  return async (actual: string) => {
    for (const needle of needles) {
      if (await contains(needle, options)(actual)) {
        return true
      }
    }
    return false
  }
}

export const matches = (pattern: RegExp) => {
  return async (actual: string) => pattern.test(actual)
}

export const judge = (config: LLMJudgeConfig) => makeScorer(config)

type JudgeRegistry<T extends Record<string, LLMJudgeConfig>> = {
  [K in keyof T]: ReturnType<typeof makeScorer>
}

export const registerJudges = <const T extends Record<string, LLMJudgeConfig>>(
  entries: T,
): JudgeRegistry<T> => {
  const registry = {} as JudgeRegistry<T>
  for (const [name, config] of Object.entries(entries) as [keyof T, LLMJudgeConfig][]) {
    registry[name] = makeScorer(config)
  }
  return registry
}
