import type { Result } from "@/src/utils/result";
import type { ModelInfo, Provider } from "../providers";

type Grader = (input: string) => Promise<boolean>;
export type Graders = Record<string, Grader>;

export type RunnerDebugPayload = {
  prompt: string;
  response: string;
  graders: [string, boolean][];
};

/**
 * Every Runner function must return a RunnerResult
 * and should never throw under normal circumstances.
 */
export type RunnerResult = Result<{
  score: number;
  debug?: RunnerDebugPayload;
}>;

/**
 * Arguments to be passed to the runner
 */
export type RunnerArgs = {
  provider: Provider;
  model: string;
  evalPath: string;
  debug?: boolean;
};

/**
 * Supported frameworks
 */
export type Framework = "Next.js"; // TODO(voz): Add more frameworks in the future

/**
 * Categories we test
 */
export type Category = "Fundamentals" | "Webhooks" | "API Routes" | "Checkout Flow";
export type Evaluation = {
  framework: Framework;
  category: Category;
  /** e.g. "evals/000-basic-nextjs" */
  path: string;
};

/**
 * A single score object for a model and category
 */
export type Score = {
  model: string;
  label: string;
  framework: Framework;
  category: Category;
  value: number;
  updatedAt?: string;
};
