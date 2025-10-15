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
  evalPath: string;
};

export type Evaluation = {
  /** e.g. "Next.js", "React", "JavaScript" */
  framework: string;
  /** e.g. "Basic", "API Routes", "Webhooks" */
  category: string;
  /** e.g. "evals/000-basic-nextjs" */
  path: string;
};

/**
 * A single score object for a model and category
 */
export type Score = {
  model: string; // e.g., "claude-sonnet-4-0"
  framework: string; // e.g., "Next.js", "React", "JavaScript"
  category: string; // e.g., "Basic", "API Routes", "Webhooks"
  value: number; // 0..1
  updatedAt?: string; // ISO date
};
