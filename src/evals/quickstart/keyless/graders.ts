import { contains, containsAny, defineGraders, judge } from '@/src/graders'
import { llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  // Core SDK setup
  import_clerk_nextjs: contains('@clerk/nextjs'),
  middleware_setup: contains('clerkMiddleware'),
  clerk_provider: contains('ClerkProvider'),
  middleware_file_name: contains('middleware.ts'),
  app_router_layout: contains('app/layout.tsx'),

  // Keyless-specific knowledge
  explains_automatic_keys: judge(
    'Does the response explain that Clerk automatically creates/provisions keys when none are configured?',
  ),
  mentions_clerk_directory: containsAny(['.clerk', 'keyless']),
  explains_claim_flow: containsAny(['claim', 'dashboard']),

  // Correct guidance
  no_manual_env_required: judge(
    'Does the response correctly indicate that no manual .env configuration is needed for the initial setup?',
  ),
  recommends_latest_version: contains('@clerk/nextjs@latest'),

  // Safety warnings
  warns_not_for_production: judge(
    'Does the response mention that keyless mode should not be used in production, or guide users to claim/configure keys before production?',
  ),

  // Standard checks
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
})
