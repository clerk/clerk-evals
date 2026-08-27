import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  // Core SDK setup
  import_clerk_nextjs: contains('@clerk/nextjs'),
  middleware_setup: contains('clerkMiddleware'),
  clerk_provider: contains('ClerkProvider'),
  middleware_file_name: containsAny(['proxy.ts', 'middleware.ts']),
  app_router_layout: contains('app/layout.tsx'),

  // Accountless setup knowledge (grader keys remain stable for score continuity)
  explains_automatic_keys: judge(
    'Does the response explain that clerk init provisions a claimable accountless application and writes development keys when the user is signed out?',
  ),
  mentions_clerk_directory: contains('clerk init'),
  explains_claim_flow: containsAny(['claim', 'dashboard']),

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
