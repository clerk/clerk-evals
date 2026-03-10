/**
 * extract-judge-verdicts.ts
 *
 * Extracts LLM judge verdicts from Android eval debug runs and produces
 * a human-reviewable markdown file for validating judge accuracy.
 *
 * Usage: bun scripts/extract-judge-verdicts.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = join(import.meta.dir, "..");
const DEBUG_RUNS = join(ROOT, "debug-runs");

const BASELINE_DIRS = [
  "2026-03-10T00-31-27-636Z",
  "2026-03-10T02-16-19-868Z",
  "2026-03-10T02-19-36-764Z",
  "2026-03-10T03-04-06-614Z",
  "2026-03-10T03-50-30-083Z",
  "2026-03-10T03-54-13-388Z",
];

const SKILLS_DIRS = [
  "skills-2026-03-10T00-39-16-359Z",
  "skills-2026-03-10T02-21-11-446Z",
  "skills-2026-03-10T02-23-52-975Z",
  "skills-2026-03-10T03-11-02-231Z",
  "skills-2026-03-10T03-58-31-719Z",
  "skills-2026-03-10T04-02-11-946Z",
];

/** Android evals and which graders are LLM judges (the ones we want to validate). */
const JUDGE_GRADERS: Record<string, { graders: string[]; criterion: string }[]> = {
  "auth-guard": [
    {
      graders: ["redirects_unauthenticated"],
      criterion:
        "When the user is not signed in, does the code redirect them to the SignIn screen?",
    },
    {
      graders: ["permission_denied_with_go_back"],
      criterion:
        'If the user lacks admin role, does the AdminSettings screen show "Permission Denied" with a "Go Back" button?',
    },
    {
      graders: ["shows_admin_settings_items"],
      criterion:
        "Does the admin screen show at least 3 admin setting items (e.g. Manage Users, Billing, API Keys)?",
    },
    {
      graders: ["dashboard_shows_user_info"],
      criterion:
        "Does the Dashboard display the user's name and email?",
    },
  ],
  "mfa-flow": [
    {
      graders: ["checks_signin_status_for_mfa"],
      criterion:
        "Does the code check the SignIn status to determine whether MFA is required before proceeding?",
    },
    {
      graders: ["three_distinct_composables"],
      criterion:
        "Are there three distinct composable functions for each sign-in step (email, password, MFA)?",
    },
    {
      graders: ["handles_errors_per_step"],
      criterion:
        "Does each step handle errors independently with contextual error messages?",
    },
  ],
  "navigation-guard": [
    {
      graders: ["saves_intended_destination"],
      criterion:
        "Does the code save/restore the intended destination when redirecting unauthenticated users to sign-in?",
    },
    {
      graders: ["admin_role_check"],
      criterion:
        "Does the code check publicMetadata for an admin role before allowing access to the admin route?",
    },
    {
      graders: ["profile_shows_user_info"],
      criterion:
        "Does the Profile screen show the user's name, email, and a Sign Out button?",
    },
    {
      graders: ["single_nav_controller"],
      criterion:
        "Is a single NavController instance used throughout the app (no multiple NavHost instances)?",
    },
  ],
  "org-switching": [
    {
      graders: ["displays_org_list_with_roles"],
      criterion:
        "Does the UI display a list of organizations with the user's role in each?",
    },
    {
      graders: ["syncs_backend_context"],
      criterion:
        "When switching orgs, does the code sync the backend context (e.g. setActive with organization ID)?",
    },
    {
      graders: ["handles_empty_state"],
      criterion:
        "Does the code handle the empty state when the user has no organizations?",
    },
    {
      graders: ["no_todo_placeholders"],
      criterion:
        'Is the code free of TODO placeholders or "not implemented" stubs in critical paths?',
    },
  ],
  "session-token": [
    {
      graders: ["implements_401_retry"],
      criterion:
        "Does the code implement 401 retry logic (refresh token on 401, retry the request)?",
    },
    {
      graders: ["handles_session_expiry_signout"],
      criterion:
        "Does the code handle session expiry by signing the user out?",
    },
    {
      graders: ["no_todo_placeholders"],
      criterion:
        'Is the code free of TODO placeholders or "not implemented" stubs in critical paths?',
    },
  ],
  "custom-setup": [
    {
      graders: ["custom_flow_quality"],
      criterion:
        "Is the custom sign-in flow well-structured with proper API usage, state management, and error handling?",
    },
  ],
};

// Keyword hints for snippet extraction per grader
const SNIPPET_KEYWORDS: Record<string, string[]> = {
  redirects_unauthenticated: [
    "Unauthenticated",
    "SignIn",
    "navigate",
    "redirect",
    "popUpTo",
    "LaunchedEffect",
    "authState",
  ],
  permission_denied_with_go_back: [
    "Permission Denied",
    "Go Back",
    "isAdmin",
    "PermissionDenied",
    "onGoBack",
  ],
  shows_admin_settings_items: [
    "AdminSetting",
    "Manage Users",
    "Billing",
    "API Keys",
    "AdminContent",
  ],
  dashboard_shows_user_info: [
    "userName",
    "userEmail",
    "fullName",
    "primaryEmailAddress",
    "Dashboard",
    "Name:",
    "Email:",
  ],
  checks_signin_status_for_mfa: [
    "needsSecondFactor",
    "second_factor",
    "MFA",
    "mfa",
    "SignInStatus",
    "attempt_second_factor",
    "attemptSecondFactor",
  ],
  three_distinct_composables: [
    "@Composable",
    "EmailIdentification",
    "PasswordVerification",
    "MfaVerification",
    "SignInStep",
    "currentStep",
  ],
  handles_errors_per_step: [
    "errorMessage",
    "error",
    "isError",
    "onErrorDismiss",
    "catch",
    "Exception",
  ],
  saves_intended_destination: [
    "pendingDeepLink",
    "intended",
    "redirect",
    "savedState",
    "destination",
    "deepLink",
  ],
  admin_role_check: [
    "publicMetadata",
    "role",
    "admin",
    "isAdmin",
    "AdminScreen",
    "Toast",
  ],
  profile_shows_user_info: [
    "ProfileScreen",
    "firstName",
    "lastName",
    "emailAddress",
    "Sign Out",
    "signOut",
  ],
  single_nav_controller: [
    "rememberNavController",
    "NavHost",
    "navController",
    "NavigationGraph",
  ],
  displays_org_list_with_roles: [
    "membership",
    "role",
    "OrganizationCard",
    "OrganizationList",
    "displayRole",
  ],
  syncs_backend_context: [
    "setActive",
    "switchOrganization",
    "activeOrganization",
    "clearActiveOrganization",
    "backend",
  ],
  handles_empty_state: [
    "EmptyState",
    "empty",
    "no organizations",
    "No Organizations",
    "Empty",
  ],
  no_todo_placeholders: ["TODO", "todo", "FIXME", "fixme", "not implemented"],
  implements_401_retry: [
    "401",
    "retry",
    "forceRefresh",
    "refresh",
    "Unauthorized",
    "unauthorized",
  ],
  handles_session_expiry_signout: [
    "signOut",
    "sign_out",
    "expir",
    "session",
    "expired",
    "forceRefresh",
  ],
  custom_flow_quality: [
    "signIn.create",
    "attemptFirstFactor",
    "attemptSecondFactor",
    "setActive",
    "sealed class",
    "ViewModel",
  ],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Verdict {
  evalName: string;
  graderName: string;
  model: string;
  mode: "baseline" | "skills";
  passed: boolean;
  snippet: string;
  criterion: string;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse grader results from a baseline .md file's grader table. */
function parseGradersFromMd(
  content: string
): Array<{ name: string; passed: boolean }> {
  const results: Array<{ name: string; passed: boolean }> = [];
  const graderSection = content.split("## Graders");
  if (graderSection.length < 2) return results;

  const tableLines = graderSection[1].trim().split("\n");
  for (const line of tableLines) {
    const match = line.match(/^\|\s*(\w+)\s*\|\s*(true|false)\s*\|$/);
    if (match) {
      results.push({ name: match[1], passed: match[2] === "true" });
    }
  }
  return results;
}

/** Parse grader results from a skills .json file. */
function parseGradersFromJson(
  content: string
): Array<{ name: string; passed: boolean }> {
  const data = JSON.parse(content);
  return (data.graders as [string, boolean][]).map(([name, passed]) => ({
    name,
    passed,
  }));
}

/** Extract the model response text from a .md debug file (between Response ~~~ fences). */
function extractResponse(content: string): string {
  // Baseline format: ## Response\n~~~\n...content...\n~~~\n\n## Graders
  const responseMatch = content.match(
    /## Response\n~~~\n([\s\S]*?)\n~~~\s*\n## Graders/
  );
  if (responseMatch) return responseMatch[1];

  // Skills .md format: the whole file is the transcript.
  // Strip everything after "## Grader Results" (if present) since that's metadata.
  const graderIdx = content.indexOf("## Grader Results");
  if (graderIdx !== -1) {
    return content.slice(0, graderIdx);
  }

  // Fallback: return everything
  return content;
}

/** Extract a relevant code snippet for a given grader from the model response. */
function extractSnippet(
  response: string,
  graderName: string,
  snippetLines = 30
): string {
  const keywords = SNIPPET_KEYWORDS[graderName] ?? [graderName];
  const lines = response.split("\n");

  // Find the best matching line (highest keyword density in surrounding context)
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const windowStart = Math.max(0, i - 5);
    const windowEnd = Math.min(lines.length, i + 5);
    const window = lines.slice(windowStart, windowEnd).join("\n");
    let score = 0;
    for (const kw of keywords) {
      if (window.toLowerCase().includes(kw.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (bestIdx < 0 || bestScore === 0) {
    // No keywords found, return first chunk of code
    const codeBlockMatch = response.match(/```kotlin[^\n]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].split("\n").slice(0, snippetLines).join("\n");
    }
    return lines.slice(0, snippetLines).join("\n");
  }

  // Extract centered window around best match
  const halfWindow = Math.floor(snippetLines / 2);
  const start = Math.max(0, bestIdx - halfWindow);
  const end = Math.min(lines.length, start + snippetLines);
  return lines.slice(start, end).join("\n");
}

/** Extract model name from a baseline file path like "anthropic__claude-sonnet-4-5.md" */
function parseBaselineModel(filename: string): string {
  // e.g. "anthropic__claude-sonnet-4-5.md" -> "claude-sonnet-4-5"
  const match = filename.match(/^(?:anthropic|openai|google)__(.+)\.md$/);
  return match ? match[1] : filename.replace(".md", "");
}

/** Extract model name from a skills file path like "evals__android__auth-guard__claude-sonnet-4-5.json" */
function parseSkillsModel(filename: string, evalName: string): string {
  // e.g. "evals__android__auth-guard__claude-sonnet-4-5.json"
  // Remove prefix "evals__android__{evalName}__" and extension
  const prefix = `evals__android__${evalName}__`;
  const withoutExt = filename.replace(/\.(json|md)$/, "");
  return withoutExt.startsWith(prefix)
    ? withoutExt.slice(prefix.length)
    : withoutExt;
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

async function collectVerdicts(): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  const androidEvals = Object.keys(JUDGE_GRADERS);

  // --- Baseline runs ---
  for (const runDir of BASELINE_DIRS) {
    const runPath = join(DEBUG_RUNS, runDir);
    for (const evalName of androidEvals) {
      const evalDir = join(runPath, `evals__android__${evalName}`);
      let entries: string[];
      try {
        entries = await readdir(evalDir);
      } catch {
        continue; // eval dir doesn't exist in this run
      }

      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const filePath = join(evalDir, entry);
        const content = await readFile(filePath, "utf-8");
        const model = parseBaselineModel(entry);
        const graders = parseGradersFromMd(content);
        const response = extractResponse(content);

        for (const judgeConfig of JUDGE_GRADERS[evalName]) {
          for (const graderName of judgeConfig.graders) {
            const grader = graders.find((g) => g.name === graderName);
            if (!grader) continue;

            verdicts.push({
              evalName,
              graderName,
              model,
              mode: "baseline",
              passed: grader.passed,
              snippet: extractSnippet(response, graderName),
              criterion: judgeConfig.criterion,
            });
          }
        }
      }
    }
  }

  // --- Skills runs ---
  for (const runDir of SKILLS_DIRS) {
    const runPath = join(DEBUG_RUNS, runDir);
    let allFiles: string[];
    try {
      allFiles = await readdir(runPath);
    } catch {
      continue;
    }

    for (const evalName of androidEvals) {
      // Find matching .json files for this eval
      const prefix = `evals__android__${evalName}__`;
      const jsonFiles = allFiles.filter(
        (f) => f.startsWith(prefix) && f.endsWith(".json")
      );

      for (const jsonFile of jsonFiles) {
        const model = parseSkillsModel(jsonFile, evalName);
        const mdFile = jsonFile.replace(".json", ".md");

        const jsonPath = join(runPath, jsonFile);
        const mdPath = join(runPath, mdFile);

        let jsonContent: string;
        let mdContent: string;
        try {
          jsonContent = await readFile(jsonPath, "utf-8");
          mdContent = await readFile(mdPath, "utf-8");
        } catch {
          continue;
        }

        const graders = parseGradersFromJson(jsonContent);
        const response = mdContent; // The .md IS the transcript

        for (const judgeConfig of JUDGE_GRADERS[evalName]) {
          for (const graderName of judgeConfig.graders) {
            const grader = graders.find((g) => g.name === graderName);
            if (!grader) continue;

            verdicts.push({
              evalName,
              graderName,
              model,
              mode: "skills",
              passed: grader.passed,
              snippet: extractSnippet(response, graderName),
              criterion: judgeConfig.criterion,
            });
          }
        }
      }
    }
  }

  return verdicts;
}

// ---------------------------------------------------------------------------
// Markdown output
// ---------------------------------------------------------------------------

function generateMarkdown(verdicts: Verdict[]): string {
  // Group by graderName, then by evalName
  const byGrader = new Map<
    string,
    { evalName: string; criterion: string; items: Verdict[] }
  >();

  for (const v of verdicts) {
    const key = `${v.graderName}::${v.evalName}`;
    if (!byGrader.has(key)) {
      byGrader.set(key, {
        evalName: v.evalName,
        criterion: v.criterion,
        items: [],
      });
    }
    byGrader.get(key)!.items.push(v);
  }

  // Sort groups by eval name then grader name
  const sortedKeys = [...byGrader.keys()].sort();

  const lines: string[] = [];
  lines.push("# Judge Validation Review");
  lines.push("");
  lines.push("## Instructions");
  lines.push(
    "For each item below, review the code snippet and the judge's verdict."
  );
  lines.push(
    "Label each as: **AGREE** (judge is correct) or **DISAGREE** (judge is wrong)."
  );
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push(
    "| Eval | Judge | Total Items | Baseline PASS | Baseline FAIL | Skills PASS | Skills FAIL |"
  );
  lines.push(
    "| --- | --- | --- | --- | --- | --- | --- |"
  );

  for (const key of sortedKeys) {
    const group = byGrader.get(key)!;
    const baselinePass = group.items.filter(
      (v) => v.mode === "baseline" && v.passed
    ).length;
    const baselineFail = group.items.filter(
      (v) => v.mode === "baseline" && !v.passed
    ).length;
    const skillsPass = group.items.filter(
      (v) => v.mode === "skills" && v.passed
    ).length;
    const skillsFail = group.items.filter(
      (v) => v.mode === "skills" && !v.passed
    ).length;
    lines.push(
      `| ${group.evalName} | ${group.items[0].graderName} | ${group.items.length} | ${baselinePass} | ${baselineFail} | ${skillsPass} | ${skillsFail} |`
    );
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Detailed sections
  let itemCounter = 0;
  for (const key of sortedKeys) {
    const group = byGrader.get(key)!;
    lines.push(`## ${group.items[0].graderName} (${group.evalName})`);
    lines.push(`**Criterion:** ${group.criterion}`);
    lines.push("");

    // Sort items: baseline first, then skills; within each, sort by model
    const sorted = [...group.items].sort((a, b) => {
      if (a.mode !== b.mode) return a.mode === "baseline" ? -1 : 1;
      return a.model.localeCompare(b.model);
    });

    for (const v of sorted) {
      itemCounter++;
      const verdict = v.passed ? "PASS" : "FAIL";
      lines.push(`### Item ${itemCounter}: ${v.model} / ${v.mode}`);
      lines.push(`**Judge verdict: ${verdict}**`);
      lines.push("");
      lines.push("```kotlin");
      lines.push(v.snippet);
      lines.push("```");
      lines.push("");
      lines.push(`Your label: [ ] AGREE  [ ] DISAGREE`);
      lines.push("");
      if (!v.passed) {
        lines.push(`> Note: Judge said FAIL. Verify this is correct.`);
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  // Stats footer
  const totalPass = verdicts.filter((v) => v.passed).length;
  const totalFail = verdicts.filter((v) => !v.passed).length;
  lines.push("## Statistics");
  lines.push("");
  lines.push(`- **Total items to review:** ${verdicts.length}`);
  lines.push(`- **Total PASS verdicts:** ${totalPass}`);
  lines.push(`- **Total FAIL verdicts:** ${totalFail}`);
  lines.push(
    `- **Unique (eval, judge) pairs:** ${sortedKeys.length}`
  );
  lines.push(
    `- **Models covered:** ${[...new Set(verdicts.map((v) => v.model))].sort().join(", ")}`
  );
  lines.push(
    `- **Modes:** baseline (${verdicts.filter((v) => v.mode === "baseline").length}), skills (${verdicts.filter((v) => v.mode === "skills").length})`
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Scanning debug runs for Android eval judge verdicts...");

  const verdicts = await collectVerdicts();
  console.log(`Found ${verdicts.length} judge verdicts across all runs.`);

  if (verdicts.length === 0) {
    console.error("No verdicts found. Check that debug-runs directories exist.");
    process.exit(1);
  }

  const markdown = generateMarkdown(verdicts);
  const outputPath = join(ROOT, "scripts", "judge-validation-review.md");
  await writeFile(outputPath, markdown, "utf-8");

  console.log(`Written to: ${outputPath}`);

  // Quick summary
  const models = [...new Set(verdicts.map((v) => v.model))].sort();
  const evals = [...new Set(verdicts.map((v) => v.evalName))].sort();
  console.log(`\nModels: ${models.join(", ")}`);
  console.log(`Evals: ${evals.join(", ")}`);
  console.log(
    `PASS: ${verdicts.filter((v) => v.passed).length}, FAIL: ${verdicts.filter((v) => !v.passed).length}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
