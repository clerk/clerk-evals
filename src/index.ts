import Tinypool from "tinypool";

import type { Score, RunnerArgs, RunnerResult } from "@/src/interfaces";

import consoleReporter from "@/src/reporters/console";
import fileReporter from "@/src/reporters/file";

// Create a pool of workers to execute the main runner
const pool = new Tinypool({
  runtime: "child_process",
  filename: new URL("./runners/main.ts", import.meta.url).href,
  isolateWorkers: true,
  idleTimeout: 10000,
  maxThreads: 10,
});

/**
 * Registered models
 * To be manually updated
 */
const models = [
  { provider: "openai", model: "gpt-4o" },
  { provider: "openai", model: "gpt-5" },
  { provider: "openai", model: "gpt-5-chat-latest" },
  { provider: "anthropic", model: "claude-sonnet-4-0" },
  { provider: "anthropic", model: "claude-sonnet-4-5" },
  { provider: "anthropic", model: "claude-opus-4-0" },
  { provider: "vercel", model: "v0-1.5-md" },
];

/**
 * Registered evaluations
 * To be manually updated
 */
const evaluations = [{ category: "Next.js", path: "evals/000-basic-nextjs" }];

// Collect list of tasks to be run
const tasks: RunnerArgs[] = models.flatMap((model) =>
  evaluations.map((evaluation) => ({
    provider: model.provider,
    model: model.model,
    category: evaluation.category,
    evalPath: new URL(evaluation.path, import.meta.url).pathname,
  }))
);

// Accumulate scores
let scores: Score[] = [];

// Run all in parallel
await Promise.all(
  tasks.map(async (task) => {
    const result: RunnerResult = await pool.run(task);

    if (!result.ok) {
      console.log({
        message: "Runner errored",
        task,
        error: result.error,
      });
      return;
    }

    const scoreObject = {
      model: task.model,
      category: task.category,
      value: result.value.score,
      updatedAt: new Date().toISOString(),
    };
    scores.push(scoreObject);
  })
);

// Report
consoleReporter(scores);
fileReporter(scores);
