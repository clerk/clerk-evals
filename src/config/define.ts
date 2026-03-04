import type { Category, Framework } from '@/src/interfaces'
import type { Provider } from '@/src/providers'

export type HookFn<T = void> = (context: T) => void | Promise<void>

export type EvalSuiteConfig = {
  /** Suite name (used in reports and Braintrust experiments) */
  name?: string

  /** Model selection */
  models?: {
    include?: string[]
    exclude?: string[]
    provider?: Provider
  }

  /** Evaluation selection */
  evaluations?: {
    include?: string[]
    exclude?: string[]
    category?: Category
    framework?: Framework
  }

  /** MCP server configuration */
  mcp?: {
    url?: string
    enabled?: boolean
  }

  /** Skills configuration */
  skills?: {
    path?: string
    enabled?: boolean
  }

  /** Runner settings */
  runners?: {
    maxThreads?: number
    idleTimeout?: number
    maxToolRounds?: number
  }

  /** Grader / judge settings */
  graders?: {
    /** Override judge model (default: gpt-4.1) */
    judgeModel?: string
  }

  /** CI gate settings */
  ci?: {
    /** Fail if average score is below this percentage (0-100) */
    failUnder?: number
  }

  /** Lifecycle hooks */
  hooks?: {
    preEval?: HookFn
    postEval?: HookFn<{ scores: Array<{ category: string; value: number }> }>
    onSuccess?: HookFn<{ model: string; category: string; score: number }>
    onError?: HookFn<{ model: string; category: string; error: unknown }>
  }
}

/**
 * Define a typed eval suite configuration.
 * If `clerk-evals.config.ts` exists at the project root, it is loaded automatically.
 */
export function defineConfig(config: EvalSuiteConfig): EvalSuiteConfig {
  return config
}

/**
 * Attempt to load `clerk-evals.config.ts` from the given directory.
 * Returns undefined if the file doesn't exist.
 */
export async function loadConfig(dir: string): Promise<EvalSuiteConfig | undefined> {
  const configPath = `${dir}/clerk-evals.config.ts`
  try {
    const mod = await import(configPath)
    return (mod.default ?? mod.config) as EvalSuiteConfig
  } catch {
    return undefined
  }
}
