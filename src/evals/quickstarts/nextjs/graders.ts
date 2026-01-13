import { contains, defineGraders, judge } from '@/src/graders'
import { authUIChecks, llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  // Correct middleware setup
  middleware_file: contains('middleware.ts'),
  clerk_middleware_import: contains("from '@clerk/nextjs/server'"),
  clerk_middleware_usage: contains('clerkMiddleware'),

  // ClerkProvider setup
  clerk_provider_usage: contains('<ClerkProvider'),
  layout_file: contains('app/layout.tsx'),

  // Package and environment
  clerk_nextjs_package: contains('@clerk/nextjs'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  environment_variables: llmChecks.environmentVariables,

  // UI components
  uses_signed_in: authUIChecks.usesSignedIn,
  uses_signed_out: authUIChecks.usesSignedOut,
  uses_user_button: authUIChecks.usesUserButton,

  // Deprecated patterns should NOT appear
  no_auth_middleware: judge(
    'Does the solution avoid using the deprecated authMiddleware() function? It should use clerkMiddleware() instead.',
  ),
  no_pages_router: judge(
    'Does the solution use the App Router (app/ directory) instead of the deprecated Pages Router (_app.tsx, pages/ directory)?',
  ),
})
