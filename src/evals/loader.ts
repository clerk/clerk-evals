import { readdir, readFile, access } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Evaluation } from "@/src/interfaces";

const REQUIRED_FILES = ["PROMPT.md", "graders.ts"];
const CONFIG_FILENAMES = ["config.json"];
const DEFAULT_FRAMEWORK = "Next.js";

export type LoadedEvaluation = Evaluation & { enabled: boolean };

type EvaluationConfig = {
  framework?: string;
  category?: string;
  name?: string;
  enabled?: boolean;
};

const fileExists = async (target: string) => {
  try {
    await access(target, FS_CONSTANTS.F_OK);
    return true;
  } catch {
    return false;
  }
};

const isEvaluationDirectory = async (dir: string) => {
  for (const required of REQUIRED_FILES) {
    if (!(await fileExists(path.join(dir, required)))) {
      return false;
    }
  }
  return true;
};

const readConfig = async (dir: string): Promise<EvaluationConfig> => {
  for (const filename of CONFIG_FILENAMES) {
    const filePath = path.join(dir, filename);
    if (await fileExists(filePath)) {
      const raw = await readFile(filePath, "utf8");
      try {
        return JSON.parse(raw) as EvaluationConfig;
      } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${(error as Error).message}`);
      }
    }
  }
  return {};
};

const toTitleCase = (value: string) =>
  value
    .replace(/^[0-9]+-/, "")
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const deriveCategory = (relativePath: string) => {
  const [first] = relativePath.split("/");
  return first ? toTitleCase(first) : "General";
};

const deriveName = (relativePath: string) => {
  const segments = relativePath.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? toTitleCase(last) : toTitleCase(relativePath);
};

export const loadEvaluations = async (
  baseDir: URL | string
): Promise<LoadedEvaluation[]> => {
  const rootPath = typeof baseDir === "string" ? baseDir : fileURLToPath(baseDir);
  const evaluations: LoadedEvaluation[] = [];

  const walk = async (current: string) => {
    if (await isEvaluationDirectory(current)) {
      const relative = path.relative(rootPath, current).split(path.sep).join("/");
      if (!relative) {
        return;
      }

      const config = await readConfig(current);
      const evaluationPath = `evals/${relative}`;

      evaluations.push({
        framework: (config.framework ?? DEFAULT_FRAMEWORK) as Evaluation["framework"],
        category: config.category ?? deriveCategory(relative),
        path: evaluationPath,
        name: config.name ?? deriveName(relative),
        enabled: config.enabled ?? true,
      });
      return;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.startsWith(".")) {
        continue;
      }
      if (entry.name === "node_modules") {
        continue;
      }
      await walk(path.join(current, entry.name));
    }
  };

  await walk(rootPath);

  return evaluations.sort((a, b) => a.path.localeCompare(b.path));
};
