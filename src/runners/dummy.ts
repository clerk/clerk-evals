import { ERR, OK } from "@/src/utils/result";
import type { RunnerResult, RunnerArgs } from "@/src/interfaces";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// This is a dummy runner that returns a random score and randomly errors
export default async function dummy(_: RunnerArgs): Promise<RunnerResult> {
  // Simulate some work
  await sleep(500 + Math.random() * 2000);

  // random error
  if (Math.random() > 0.99) {
    return ERR(new Error("Random error"));
  }

  // weight it as more likely to be higher scores
  const r = Math.random();
  // 50% chance of > 0.8
  // 30% chance of > 0.5
  // 20% chance of > 0.2
  if (r > 0.5) {
    return OK({
      score: 0.8 + Math.random() * 0.2,
    });
  }
  if (r > 0.3) {
    return OK({
      score: 0.5 + Math.random() * 0.3,
    });
  }
  return OK({
    score: Math.random() * 0.2,
  });
}

// Run this for one-off testing
// bun run src/runners/dummy.ts
if (import.meta.main) {
  console.log("Running dummy");

  const result = await dummy({
    provider: "openai",
    model: "gpt-4o",
    evalPath: new URL("../evals/000-basic-nextjs", import.meta.url).pathname,
    category: "test",
  });

  console.log(result);
}
