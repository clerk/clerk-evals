import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import Tinypool from "tinypool";

import type {
  Score,
  RunnerArgs,
  RunnerResult,
  Evaluation,
  RunnerDebugPayload,
} from "@/src/interfaces";

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
const evaluations = [
  {
    framework: "Next.js",
    category: "Fundamentals",
    path: "evals/000-basic-nextjs",
  },
  {
    framework: "Next.js",
    category: "Webhooks",
    path: "evals/webhooks",
  },
  {
    framework: "Next.js",
    category: "Webhooks: Organization Memberships",
    path: "evals/webhooks-organization",
  },
  {
    framework: "Next.js",
    category: "Webhooks: Billing",
    path: "evals/webhooks-billing",
  },
  {
    framework: "Next.js",
    category: "Webhooks: Users",
    path: "evals/webhooks-users",
  },
  {
    framework: "Next.js",
    category: "Webhooks: Subscriptions",
    path: "evals/webhooks-subscriptions",
  },
  {
    framework: "Next.js",
    category: "Webhooks: Notifications",
    path: "evals/webhooks-notifications",
  },
  {
    framework: "Next.js",
    category: "API Routes",
    path: "evals/002-apiroutes",
  },
] satisfies Evaluation[];

type DebugArtifact = {
  provider: string;
  model: string;
  framework: string;
  category: string;
  evaluationPath: string;
  score: number;
  prompt: string;
  response: string;
  graders: RunnerDebugPayload["graders"];
};

type DebugError = {
  provider: string;
  model: string;
  evaluationPath: string;
  error: unknown;
};

const args = process.argv.slice(2);

const parseBooleanFlag = (name: string, alias?: string) => {
  const equalsArg = args.find((arg) => arg.startsWith(`--${name}=`));
  if (equalsArg) {
    const [, rawValue] = equalsArg.split("=", 2);
    const value = rawValue?.toLowerCase();
    return !["false", "0", "no"].includes(value ?? "");
  }

  const index = args.findIndex(
    (arg) => arg === `--${name}` || (alias && arg === alias)
  );

  if (index === -1) {
    return false;
  }

  const value = args[index + 1];
  if (value && !value.startsWith("-")) {
    return !["false", "0", "no"].includes(value.toLowerCase());
  }

  return true;
};

const getEvalArg = () => {
  const equalsArg = args.find((arg) => arg.startsWith("--eval="));
  if (equalsArg) {
    return equalsArg.split("=", 2)[1];
  }

  const index = args.findIndex((arg) => arg === "--eval" || arg === "-e");
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    console.error("Missing value for --eval");
    process.exit(1);
  }

  return value;
};

const normalizeEvalPath = (value: string) => {
  if (value.startsWith("./")) {
    return normalizeEvalPath(value.slice(2));
  }
  if (value.startsWith("evals/")) {
    return value;
  }
  return `evals/${value}`;
};

const evalArg = getEvalArg();

const debugEnabled = parseBooleanFlag("debug", "-d");

const selectedEvaluations = (() => {
  if (!evalArg) {
    return evaluations;
  }

  const normalized = normalizeEvalPath(evalArg);
  const target = evaluations.find(
    (evaluation) =>
      evaluation.path === normalized ||
      evaluation.path.endsWith(`/${normalized}`) ||
      evaluation.path.endsWith(`/${evalArg}`)
  );

  if (!target) {
    console.error(
      `No evaluation matching "${evalArg}". Available evaluations: ${evaluations
        .map((evaluation) => evaluation.path)
        .join(", ")}`
    );
    process.exit(1);
  }

  console.log(
    `Running single evaluation "${target.path}" for all registered models`
  );

  return [target];
})();

const debugArtifacts: DebugArtifact[] = [];
const debugErrors: DebugError[] = [];

let debugRunDirectory: string | undefined;
let debugRunTimestamp: string | undefined;

if (debugEnabled) {
  debugRunTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  debugRunDirectory = path.join(
    process.cwd(),
    "debug-runs",
    debugRunTimestamp
  );
  await mkdir(debugRunDirectory, { recursive: true });
  console.log(`Debug mode enabled. Saving outputs to ${debugRunDirectory}`);
}

// Collect list of tasks to be run
const tasks = models.flatMap((model) =>
  selectedEvaluations.map((evaluation) => ({
    provider: model.provider,
    model: model.model,
    category: evaluation.category,
    framework: evaluation.framework,
    evalPath: new URL(evaluation.path, import.meta.url).pathname,
    evaluationPath: evaluation.path,
  }))
);

// Accumulate scores
let scores: Score[] = [];

// Run all in parallel
await Promise.all(
  tasks.map(async (task) => {
    const runnerArgs = {
      evalPath: task.evalPath,
      provider: task.provider,
      model: task.model,
      debug: debugEnabled,
    } satisfies RunnerArgs;

    const result: RunnerResult = await pool.run(runnerArgs);

    if (!result.ok) {
      console.log({
        message: "Runner errored",
        task,
        error: result.error,
      });
      if (debugEnabled) {
        debugErrors.push({
          provider: task.provider,
          model: task.model,
          evaluationPath: task.evaluationPath,
          error: result.error,
        });
      }
      return;
    }

    const scoreObject = {
      model: task.model,
      framework: task.framework,
      category: task.category,
      value: result.value.score,
      updatedAt: new Date().toISOString(),
    };
    scores.push(scoreObject);

    if (debugEnabled && result.value.debug) {
      debugArtifacts.push({
        provider: task.provider,
        model: task.model,
        framework: task.framework,
        category: task.category,
        evaluationPath: task.evaluationPath,
        score: result.value.score,
        prompt: result.value.debug.prompt,
        response: result.value.debug.response,
        graders: result.value.debug.graders,
      });
    }
  })
);

const sanitizeForFilename = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_");

if (debugEnabled && debugRunDirectory && debugRunTimestamp) {
  for (const artifact of debugArtifacts) {
    const evaluationSlug = artifact.evaluationPath
      .split("/")
      .filter(Boolean)
      .join("__");
    const evaluationDir = path.join(debugRunDirectory, evaluationSlug);
    await mkdir(evaluationDir, { recursive: true });

    const fileSafeName = sanitizeForFilename(
      `${artifact.provider}__${artifact.model}`
    );

    const gradersRows =
      artifact.graders.length > 0
        ? artifact.graders
            .map(
              // TODO(voz): To make things pretty we could swap true/false for ✅/❌
              ([name, passed]) => `| ${name} | ${passed ? "true" : "false"} |`
            )
            .join("\n")
        : "| (none) | - |";

    const debugContent = `---
provider: ${artifact.provider}
model: ${artifact.model}
framework: ${artifact.framework}
category: ${artifact.category}
evaluation: ${artifact.evaluationPath}
score: ${artifact.score.toFixed(2)}
run_at: ${debugRunTimestamp}
---

## Prompt
~~~
${artifact.prompt.trimEnd()}
~~~

## Response
~~~
${artifact.response.trimEnd()}
~~~

## Graders
| name | passed |
| --- | --- |
${gradersRows}
`;

    const filePath = path.join(evaluationDir, `${fileSafeName}.md`);
    await writeFile(filePath, debugContent, "utf8");
  }

  if (debugErrors.length > 0) {
    const errorsPath = path.join(debugRunDirectory, "errors.json");
    await writeFile(
      errorsPath,
      JSON.stringify(debugErrors, null, 2),
      "utf8"
    );
  }
}

// Report
consoleReporter(scores);
fileReporter(scores);
