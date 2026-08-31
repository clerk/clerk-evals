import { all, contains, containsAny, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  // Core SDK setup
  import_clerk_nextjs: contains('@clerk/nextjs'),
  middleware_setup: contains('clerkMiddleware'),
  clerk_provider: contains('ClerkProvider'),
  middleware_file_name: contains('proxy.ts'),
  app_router_layout: contains('app/layout.tsx'),

  // Accountless setup knowledge. Grader keys remain stable for score continuity,
  // but semantics changed with the 2026-08 accountless rename: middleware_file_name
  // now expects proxy.ts and mentions_clerk_directory checks the CLI command.
  explains_automatic_keys: judge(
    'Does the response explain that the accountless clerk init flow provisions a claimable application and writes development keys without requiring a Clerk account?',
  ),
  mentions_clerk_directory: all(containsAny(['clerk init', 'clerk@latest init']), contains('--accountless')),
  explains_claim_flow: contains('auth login'),

  // Correct guidance
  no_manual_env_required: judge(
    'Does the response correctly explain that the user should run clerk init instead of manually configuring environment variables first?',
  ),
  recommends_latest_version: contains('@clerk/nextjs@latest'),

  // Safety warnings
  warns_not_for_production: judge(
    'Does the response guide the user to claim the accountless application before transitioning to production?',
  ),

  // Standard checks
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
})
