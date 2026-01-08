import * as fs from "node:fs/promises";
import * as path from "node:path";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generateText, stepCountIs } from "ai";
import type { Graders } from "@/src/graders";
import type {
  MCPRunnerArgs,
  RunnerResult,
  ToolCallInfo,
  ToolResultInfo,
} from "@/src/interfaces";
import { getModel } from "@/src/providers";
import { ERR, OK } from "@/src/utils/result";

/**
 * System prompt for MCP evaluations.
 * Identical to baseline runner - tools are discovered dynamically via MCP.
 */
const systemPrompt = `
YOU MUST output all files as fenced code blocks, like so

\`\`\`lang file="path/to/file.ts"

\`\`\`
`;

/**
 * MCP Runner - executes evaluations with MCP tool support
 */
export default async function exec({
  provider,
  model,
  evalPath,
  mcpServerUrl,
  maxToolRounds = 10,
  debug = false,
}: MCPRunnerArgs): Promise<RunnerResult> {
  const languageModel = getModel(provider, model);
  if (!languageModel) {
    return ERR(new Error(`Unsupported: ${provider}/${model}`));
  }

  let mcpClient: Awaited<
    ReturnType<typeof experimental_createMCPClient>
  > | null = null;

  try {
    // Connect to MCP server using StreamableHTTPClientTransport (0.0.12 API)
    console.log(`[MCP] Connecting to ${mcpServerUrl}...`);
    const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));
    mcpClient = await experimental_createMCPClient({ transport });
    console.log(`[MCP] Connected successfully`);

    // Get MCP tools
    console.log(`[MCP] Fetching available tools...`);
    const mcpTools = await mcpClient.tools();
    const toolNames = Object.keys(mcpTools);
    console.log(`[MCP] Got ${toolNames.length} tools: ${toolNames.join(", ")}`);

    // Load the prompt
    const prompt = await fs.readFile(path.join(evalPath, "PROMPT.md"), "utf8");

    // Generate with tool support and agentic loop
    console.log(`[MCP] Starting generation with model ${model}...`);
    const response = await generateText({
      model: languageModel,
      prompt,
      system: systemPrompt,
      tools: mcpTools,
      stopWhen: stepCountIs(maxToolRounds),
      maxTokens: 16384,
      onStepFinish: (step) => {
        // Log each step as it completes
        const stepToolCalls = step.toolCalls || [];
        const stepToolResults = step.toolResults || [];

        if (stepToolCalls.length > 0) {
          console.log(`\n[MCP] === TOOL CALLS ===`);
          for (const tc of stepToolCalls) {
            console.log(`[MCP] Tool: ${tc.toolName}`);
            // AI SDK uses 'input' not 'args'
            const tcAny = tc as Record<string, unknown>;
            const input = tcAny.input || tc.args;
            const inputStr = input ? JSON.stringify(input, null, 2) : "(no input)";
            console.log(`[MCP] Input: ${inputStr}`);
          }
        }

        if (stepToolResults.length > 0) {
          console.log(`\n[MCP] === TOOL RESULTS ===`);
          for (const tr of stepToolResults) {
            console.log(`[MCP] Tool: ${tr.toolName}`);
            // AI SDK MCP uses 'output' not 'result'
            const trAny = tr as Record<string, unknown>;
            const output = trAny.output as { content?: Array<{ text?: string }> } | undefined;
            const result = tr.result as Record<string, unknown> | undefined;

            // Try output.content[0].text first (MCP format)
            const text = output?.content?.[0]?.text;
            if (text) {
              const preview = text.length > 300 ? `${text.slice(0, 300)}...` : text;
              console.log(`[MCP] Result: ${preview}`);
            } else if (result) {
              const resultStr = JSON.stringify(result, null, 2) || "(empty)";
              console.log(`[MCP] Result: ${resultStr.slice(0, 300)}`);
            } else {
              console.log(`[MCP] Result: (no result)`);
            }
          }
        }

        if (step.text && step.text.length > 0) {
          console.log(`\n[MCP] === ASSISTANT TEXT ===`);
          const preview =
            step.text.length > 300
              ? `${step.text.slice(0, 300)}...`
              : step.text;
          console.log(`[MCP] ${preview}`);
        }

        console.log(`[MCP] Step finished: ${step.finishReason}`);
      },
    });

    // Summary logging
    console.log(`\n[MCP] === GENERATION COMPLETE ===`);
    console.log(`[MCP] Total steps: ${response.steps?.length || 0}`);
    console.log(`[MCP] Final text length: ${response.text?.length || 0}`);
    console.log(`[MCP] Finish reason: ${response.finishReason}`);

    // Extract tool usage info and combine all text from steps
    const toolCalls: ToolCallInfo[] = [];
    const toolResults: ToolResultInfo[] = [];
    const allTextParts: string[] = [];

    // Build markdown chat transcript for debugging
    const chatTranscript: string[] = [];
    chatTranscript.push("# MCP Evaluation Transcript\n");
    chatTranscript.push("## System Prompt\n");
    chatTranscript.push("```");
    chatTranscript.push(systemPrompt.trim());
    chatTranscript.push("```\n");
    chatTranscript.push("## User Prompt\n");
    chatTranscript.push("```markdown");
    chatTranscript.push(prompt.trim());
    chatTranscript.push("```\n");
    chatTranscript.push("---\n");
    chatTranscript.push("## Conversation\n");

    if (response.steps) {
      for (let stepIdx = 0; stepIdx < response.steps.length; stepIdx++) {
        const step = response.steps[stepIdx];
        chatTranscript.push(`### Step ${stepIdx + 1} (${step.finishReason})\n`);

        // Assistant text
        if (step.text) {
          allTextParts.push(step.text);
          chatTranscript.push("**Assistant:**\n");
          const displayText =
            step.text.length > 500
              ? `${step.text.slice(0, 500)}...\n\n_(truncated, ${step.text.length} chars total)_`
              : step.text;
          chatTranscript.push(displayText);
          chatTranscript.push("\n");
        }

        // Tool calls
        if (step.toolCalls && step.toolCalls.length > 0) {
          chatTranscript.push("**Tool Calls:**\n");
          for (const tc of step.toolCalls) {
            toolCalls.push({
              toolName: tc.toolName,
              args: tc.args || {},
            });
            chatTranscript.push(`\`${tc.toolName}\``);
            chatTranscript.push("```json");
            chatTranscript.push(JSON.stringify(tc.args || {}, null, 2));
            chatTranscript.push("```\n");
          }
        }

        // Tool results
        if (step.toolResults && step.toolResults.length > 0) {
          chatTranscript.push("**Tool Results:**\n");
          for (const tr of step.toolResults) {
            const rawResult = tr.result as
              | {
                  output?: { content?: Array<{ text?: string }> };
                  content?: Array<{ text?: string }>;
                }
              | undefined;

            let textContent =
              rawResult?.output?.content?.[0]?.text ||
              rawResult?.content?.[0]?.text ||
              (typeof rawResult === "string" ? rawResult : undefined);

            const trAny = tr as Record<string, unknown>;
            if (!textContent && trAny.output) {
              const output = trAny.output as {
                content?: Array<{ text?: string }>;
              };
              textContent = output?.content?.[0]?.text;
            }

            toolResults.push({
              toolName: tr.toolName,
              result: textContent || rawResult || trAny.output || "(no result)",
            });

            chatTranscript.push(`\`${tr.toolName}\` returned:`);
            if (textContent) {
              const displayResult =
                textContent.length > 1000
                  ? `${textContent.slice(0, 1000)}...\n\n_(truncated, ${textContent.length} chars total)_`
                  : textContent;
              chatTranscript.push("```");
              chatTranscript.push(displayResult);
              chatTranscript.push("```\n");
            } else if (rawResult !== undefined && rawResult !== null) {
              chatTranscript.push("```json");
              const resultStr = JSON.stringify(rawResult, null, 2) || "(empty)";
              chatTranscript.push(resultStr.slice(0, 500));
              chatTranscript.push("```\n");
            } else if (trAny.output) {
              chatTranscript.push("```json");
              const resultStr =
                JSON.stringify(trAny.output, null, 2) || "(empty)";
              chatTranscript.push(resultStr.slice(0, 500));
              chatTranscript.push("```\n");
            } else {
              chatTranscript.push("```json");
              chatTranscript.push(
                `// Debug: tr keys = ${Object.keys(tr).join(", ")}`,
              );
              chatTranscript.push(JSON.stringify(tr, null, 2).slice(0, 300));
              chatTranscript.push("```\n");
            }
          }
        }

        chatTranscript.push("---\n");
      }
    }

    // Use combined text from all steps, or fall back to response.text
    const fullResponse =
      allTextParts.length > 0 ? allTextParts.join("\n\n") : response.text;

    // Load and run graders
    const graderModule = (await import(path.join(evalPath, "graders.ts"))) as {
      graders: Graders;
    };

    const graderResults: [string, boolean][] = [];
    for (const [key, grader] of Object.entries(graderModule.graders)) {
      const passed = await grader(fullResponse);
      graderResults.push([key, passed]);
    }

    const score =
      graderResults.filter(([_, isCorrect]) => isCorrect).length /
      (graderResults.length || 1);

    // Log grader results
    console.log(`\n[MCP] === GRADER RESULTS ===`);
    console.log(
      `[MCP] Score: ${(score * 100).toFixed(1)}% (${graderResults.filter(([_, p]) => p).length}/${graderResults.length})`,
    );
    for (const [name, passed] of graderResults) {
      console.log(`[MCP] ${passed ? "PASS" : "FAIL"}: ${name}`);
    }

    // Add grader results to transcript
    chatTranscript.push("## Grader Results\n");
    chatTranscript.push(
      `**Score: ${(score * 100).toFixed(1)}%** (${graderResults.filter(([_, p]) => p).length}/${graderResults.length})\n`,
    );
    chatTranscript.push("| Grader | Result |");
    chatTranscript.push("|--------|--------|");
    for (const [name, passed] of graderResults) {
      chatTranscript.push(`| ${name} | ${passed ? "PASS" : "FAIL"} |`);
    }
    chatTranscript.push("");

    return OK({
      score,
      debug: debug
        ? {
            prompt,
            response: fullResponse,
            graders: graderResults,
            toolCalls,
            toolResults,
            transcript: chatTranscript.join("\n"),
          }
        : undefined,
    });
  } catch (error) {
    console.error(`[MCP] Error:`, error);
    return ERR(error);
  } finally {
    // Always close MCP client
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}
