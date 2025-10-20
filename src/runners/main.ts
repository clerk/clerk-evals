import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { generateText } from 'ai'
import type { RunnerArgs, RunnerResult } from '@/src/interfaces'
import { getModel } from '@/src/providers'
import { ERR, OK } from '@/src/utils/result'
import type { Graders } from '@/src/graders'

/**
 * Instruct the model to output all files as fenced code blocks,
 * for simplicity, and ease of one-shot evaluation.
 */
const systemPrompt = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"

\`\`\`\
`

/**
 * Our main runner implementation
 */
export default async function exec({
  provider,
  model,
  evalPath,
  debug = false,
}: RunnerArgs): Promise<RunnerResult> {
  // Determine the language model
  const languageModel = getModel(provider, model)
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`))
  }

  try {
    // Load the prompt
    const prompt = await fs.readFile(path.join(evalPath, 'PROMPT.md'), 'utf8')

    // Generate the answer
    const response = await generateText({
      model: languageModel,
      prompt,
      system: systemPrompt,
    })

    // Load the graders
    const graderModule = (await import(path.join(evalPath, 'graders.ts'))) as {
      graders: Graders
    }

    // Preserve the result of each grader
    const graderResults = [] as [string, boolean][]
    for (const [key, grader] of Object.entries(graderModule.graders)) {
      const passed = await grader(response.text)
      graderResults.push([key, passed])
    }

    // Fold the result into a percentage score
    const score =
      graderResults.filter(([_, isCorrect]) => isCorrect).length / (graderResults.length || 1)

    return OK({
      score,
      debug: debug
        ? {
            prompt,
            response: response.text,
            graders: graderResults,
          }
        : undefined,
    })
  } catch (error) {
    return ERR(error)
  }
}

// For conditional below
declare global {
  interface ImportMeta {
    main?: boolean
  }
}

// Run this for one-off testing
// bun run src/runners/main.ts
if (import.meta.main) {
  console.log('Running main')

  const result = await exec({
    provider: 'openai',
    model: 'gpt-4o',
    evalPath: new URL('../evals/000-basic-nextjs', import.meta.url).pathname,
  })

  console.log(result)
}
