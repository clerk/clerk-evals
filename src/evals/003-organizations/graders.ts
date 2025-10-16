import type { Graders } from "@/src/interfaces";
import { makeScorer } from "@/src/scorers/llm";

export const graders = {
  // extremely simple graders for now
  import_package: async (actual) => actual.includes("@clerk/nextjs/server"),
  import_function: async (actual) => actual.includes("clerkMiddleware"),
  middleware_file_name: async (actual) => actual.includes("middleware.ts"),

  // llm-as-judge
  package_json_clerk_version: makeScorer(
    "Does the content contain a package.json codeblock, and does it specify @clerk/nextjs version >= 6.0.0 OR equal to 'latest'?"
  ),
  environment_variables: makeScorer(
    "Does the content contain a .env.local codeblock, and does it specify CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?"
  ),

  // This is because Clerk forces orgs, if enabled, which is assumed to be
  // the case for this particular test. Therefore, orgs should never be falsy
  // if a user is signed in.
  must_not_expect_falsy_org: makeScorer(
    "The submission MUST NOT have any code that expects `orgId` or `orgSlug` to be falsy IF the user is signed in."
  ),
} satisfies Graders;
