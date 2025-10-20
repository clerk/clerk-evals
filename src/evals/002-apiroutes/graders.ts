import type { Graders } from '@/src/interfaces'
import { makeScorer } from '@/src/scorers/llm'

export const graders = {
  // extremely simple graders for now
  import_package: async (actual) => actual.includes('@clerk/nextjs/server'),
  import_function: async (actual) => actual.includes('clerkMiddleware'),
  middleware_file_name: async (actual) => actual.includes('middleware.ts'),
  app_router_layout: async (actual) => actual.includes('app/layout.tsx'),
  api_hello_route: async (actual) => actual.includes('app/api/hello/route.ts'),

  // llm-as-judge
  package_json_clerk_version: makeScorer(
    "Does the content contain a package.json codeblock, and does it specify @clerk/nextjs version >= 6.0.0 OR equal to 'latest'?",
  ),
  environment_variables: makeScorer(
    'Does the content contain a .env.local codeblock, and does it specify CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?',
  ),
  correct_auth_protect: makeScorer('Does the /api/hello route call `await auth()`?'),
  current_user_helper: makeScorer(
    "Does the /api/user route demonstrate using currentUser() from '@clerk/nextjs/server' to retrieve the current user's information in a route handler?",
  ),
} satisfies Graders
