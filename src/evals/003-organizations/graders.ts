import type { Graders } from '@/src/interfaces'
import { makeScorer } from '@/src/scorers/llm'

export const graders = {
  // extremely simple graders for now
  import_package: async (actual) => actual.includes('@clerk/nextjs/server'),
  import_function: async (actual) => actual.includes('clerkMiddleware'),
  middleware_file_name: async (actual) => actual.includes('middleware.ts'),

  // Next.js dynamic route for org slug
  orgs_dynamic_route: async (actual) => actual.includes('app/orgs/['),

  // llm-as-judge
  package_json_clerk_version: makeScorer(
    "Does the content contain a package.json codeblock, and does it specify @clerk/nextjs version >= 6.0.0 OR equal to 'latest'?",
  ),
  environment_variables: makeScorer(
    'Does the content contain a .env.local codeblock, and does it specify CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?',
  ),

  // Golden code looks like:
  // import { auth } from "@clerk/nextjs/server";
  // const { orgId, orgSlug } = await auth();
  org_slug_from_await_auth: makeScorer(
    'Does the content contain a codeblock that calls `await auth()` and accesses the `orgSlug`?',
  ),
} satisfies Graders
