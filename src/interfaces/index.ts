import type { Result } from "@/src/utils/result";

type Grader = (input: string) => Promise<boolean>;
export type Graders = Record<string, Grader>;

/**
 * Every Runner function must return a RunnerResult
 * and should never throw under normal circumstances.
 */
export type RunnerResult = Result<{
  score: number;
}>;

/**
 * Arguments to be passed to the runner
 */
export type RunnerArgs = {
  provider: string;
  model: string;
  category: string;
  evalPath: string;
};

/**
 * A single score object for a model and category
 */
export type Score = {
  model: string; // e.g., "claude-sonnet-4-0"
  category: string; // e.g., "Next.js", "React", "JavaScript"
  value: number; // 0..1
  updatedAt?: string; // ISO date
};
