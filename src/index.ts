import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import Tinypool from "tinypool";

import type {
  Score,
  RunnerArgs,
  RunnerResult,
  RunnerDebugPayload,
} from "@/src/interfaces";

import consoleReporter from "@/src/reporters/console";
import fileReporter from "@/src/reporters/file";
import type { ModelInfo, Provider } from "@/src/providers";
import { loadEvaluations } from "@/src/evals/loader";

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
const models: ModelInfo[] = [
  { provider: "openai", name: "gpt-4o", label: "GPT-4o" },
  { provider: "openai", name: "gpt-5", label: "GPT-5" },
  { provider: "openai", name: "gpt-5-chat-latest", label: "GPT-5 (Chat, Latest)" },
  { provider: "anthropic", name: "claude-sonnet-4-0", label: "Claude Sonnet 4.0" },
  { provider: "anthropic", name: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { provider: "anthropic", name: "claude-opus-4-0", label: "Claude Opus 4.0" },
  { provider: "vercel", name: "v0-1.5-md", label: "v0-1.5-md" },
];

type DebugArtifact = {
  provider: string;
  model: string;
  framework: string;
  category: string;
  evaluationPath: string;
  evaluationName?: string;
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

const evalsRoot = new URL("./evals", import.meta.url);
const allEvaluations = await loadEvaluations(evalsRoot);
const enabledEvaluations = allEvaluations.filter(
  (evaluation) => evaluation.enabled !== false
);

if (enabledEvaluations.length === 0) {
  console.error(
    "No enabled evaluations found under evals/. Add a config.json with `enabled: true` to at least one suite."
  );
  process.exit(1);
}

const findEvaluation = (value: string) => {
  const normalizedPath = normalizeEvalPath(value);
  const normalizedPathLower = normalizedPath.toLowerCase();
  const normalizedSuffixLower = normalizedPathLower.replace(/^evals\//, "");
  const valueLower = value.toLowerCase();

  return allEvaluations.find((evaluation) => {
    const pathLower = evaluation.path.toLowerCase();
    const suffixLower = pathLower.replace(/^evals\//, "");
    const suffixMatches =
      normalizedSuffixLower.length > 0 &&
      suffixLower.endsWith(normalizedSuffixLower);
    return (
      pathLower === normalizedPathLower ||
      suffixLower === normalizedSuffixLower ||
      suffixMatches ||
      evaluation.name?.toLowerCase() === valueLower
    );
  });
};

const selectedEvaluations = (() => {
  if (!evalArg) {
    return enabledEvaluations;
  }

  const target = findEvaluation(evalArg);

  if (!target) {
    const available = enabledEvaluations
      .map((evaluation) =>
        evaluation.name
          ? `${evaluation.name} [${evaluation.path.replace(/^evals\//, "")}]`
          : evaluation.path.replace(/^evals\//, "")
      )
      .join(", ");
    console.error(
      `No evaluation matching "${evalArg}". Available evaluations: ${available}`
    );
    process.exit(1);
  }

  if (target.enabled === false) {
    console.error(
      `Evaluation "${target.name ?? target.path}" is disabled. Update ${
        target.path
      }/config.json to enable it.`
    );
    process.exit(1);
  }

  console.log(
    `Running single evaluation "${target.name ?? target.path}" for all registered models`
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
    model: model.name,
    label: model.label,
    category: evaluation.category,
    framework: evaluation.framework,
    evalPath: new URL(evaluation.path, import.meta.url).pathname,
    evaluationPath: evaluation.path,
    evaluationName: evaluation.name,
  }))
);

// Accumulate scores
let scores: Score[] = [];

// Run all in parallel
await Promise.all(
  tasks.map(async (task) => {
    const runnerArgs: RunnerArgs = {
      evalPath: task.evalPath,
      provider: task.provider as Provider,
      model: task.model,
      debug: debugEnabled,
    };

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

    const score: Score = {
      model: task.model,
      label: task.label,
      framework: task.framework,
      category: task.category,
      value: result.value.score,
      updatedAt: new Date().toISOString(),
    };
    scores.push(score);

    if (debugEnabled && result.value.debug) {
      debugArtifacts.push({
        provider: task.provider,
        model: task.model,
        framework: task.framework,
        category: task.category,
        evaluationPath: task.evaluationPath,
        evaluationName: task.evaluationName,
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
            .map(([name, passed]) => `| ${name} | ${passed ? "true" : "false"} |`)
            .join("\n")
        : "| (none) | - |";

    const evaluationNameLine = artifact.evaluationName
      ? `evaluation_name: ${artifact.evaluationName}\n`
      : "";

    const debugContent = `---
provider: ${artifact.provider}
model: ${artifact.model}
framework: ${artifact.framework}
category: ${artifact.category}
evaluation: ${artifact.evaluationPath}
${evaluationNameLine}score: ${artifact.score.toFixed(2)}
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
