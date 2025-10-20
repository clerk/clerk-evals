import { readdir, readFile, access } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Evaluation } from "@/src/interfaces";

const REQUIRED_FILES = ["PROMPT.md", "graders.ts"];
const CONFIG_FILENAMES = ["config.json"];
const DEFAULT_FRAMEWORK = "Next.js";
const CATEGORY_CONFIG_FILENAME = "category.json";

export type LoadedEvaluation = Evaluation & { enabled: boolean };

type EvaluationConfig = {
  framework?: string;
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

const deriveCategorySegment = (relativePath: string) => {
  const [first] = relativePath.split("/");
  return first ?? "";
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
  const categoryMetadata = new Map<string, { name?: string }>();

  const readCategoryMetadata = async (dir: string, relative: string) => {
    if (!relative) {
      return;
    }
    const segments = relative.split("/");
    if (segments.length !== 1) {
      return;
    }
    const categoryConfigPath = path.join(dir, CATEGORY_CONFIG_FILENAME);
    if (!(await fileExists(categoryConfigPath))) {
      return;
    }
    const raw = await readFile(categoryConfigPath, "utf8");
    try {
      const parsed = JSON.parse(raw) as { name?: string };
      categoryMetadata.set(segments[0] ?? "", { name: parsed.name });
    } catch (error) {
      throw new Error(
        `Failed to parse ${categoryConfigPath}: ${(error as Error).message}`
      );
    }
  };

  const getCategoryLabel = (segment: string) =>
    segment ? categoryMetadata.get(segment)?.name ?? toTitleCase(segment) : "General";

  const walk = async (current: string) => {
    const relative = path.relative(rootPath, current).split(path.sep).join("/");
    await readCategoryMetadata(current, relative);

    if (await isEvaluationDirectory(current)) {
      if (!relative) {
        return;
      }

      const config = await readConfig(current);
      const evaluationPath = `evals/${relative}`;

      const categorySegment = deriveCategorySegment(relative);
      const category = getCategoryLabel(categorySegment);

      evaluations.push({
        framework: (config.framework ?? DEFAULT_FRAMEWORK) as Evaluation["framework"],
        category,
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
