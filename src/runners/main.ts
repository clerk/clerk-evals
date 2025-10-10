import * as fs from "fs/promises";
import * as path from "path";

import { generateText } from "ai";

import { getModel } from "@/src/providers";
import type { Graders, RunnerResult, RunnerArgs } from "@/src/interfaces";
import { ERR, OK } from "@/src/utils/result";

/**
 * Instruct the model to output all files as fenced code blocks,
 * for simplicity, and ease of one-shot evaluation.
 */
const systemPrompt = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"

\`\`\`\
`;

/**
 * Our main runner implementation
 */
export default async function exec({
  provider,
  model,
  evalPath,
}: RunnerArgs): Promise<RunnerResult> {
  // Determine the language model
  const languageModel = getModel(provider, model);
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`));
  }

  try {
    // Load the prompt
    const prompt = await fs.readFile(path.join(evalPath, "PROMPT.txt"), "utf8");

    // Generate the answer
    const response = await generateText({
      model: languageModel,
      prompt,
      system: systemPrompt,
    });

    // Load the graders
    const graderModule = (await import(path.join(evalPath, "graders.ts"))) as {
      graders: Graders;
    };

    // Preserve the result of each grader
    let result = [] as [string, boolean][];
    for (const [key, grader] of Object.entries(graderModule.graders)) {
      const passed = await grader(response.text);
      result.push([key, passed]);
    }

    // Fold the result into a percentage score
    const score =
      result.filter(([_, isCorrect]) => isCorrect).length / result.length;

    return OK({ score });
  } catch (error) {
    return ERR(error);
  }
}

// Run this for one-off testing
// bun run src/runners/main.ts
if (import.meta.main) {
  console.log("Running main");

  const result = await exec({
    provider: "openai",
    model: "gpt-4o",
    evalPath: new URL("../evals/000-basic-nextjs", import.meta.url).pathname,
    category: "test",
  });

  console.log(result);
}
