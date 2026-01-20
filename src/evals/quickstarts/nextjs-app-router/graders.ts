import { contains, defineGraders, judge } from '@/src/graders'
import { authUIChecks, llmChecks, quickstartChecks } from '@/src/graders/catalog'

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

  // UI components
  uses_signed_in: authUIChecks.usesSignedIn,
  uses_signed_out: authUIChecks.usesSignedOut,
  uses_user_button: authUIChecks.usesUserButton,

  // Quickstart checks
  uses_clerk_middleware: quickstartChecks.usesClerkMiddleware,
  uses_clerk_provider: quickstartChecks.usesClerkProvider,
  no_deprecated_patterns: quickstartChecks.noDeprecatedPatterns,

  // Deprecated patterns should NOT appear
  no_auth_middleware: judge(
    'Does the solution avoid using the deprecated authMiddleware() function? It should use clerkMiddleware() instead.',
  ),
  no_pages_router: judge(
    'Does the solution use the App Router (app/ directory) instead of the deprecated Pages Router (_app.tsx, pages/ directory)?',
  ),

  // Verification steps from the prompt
  verifies_middleware: judge(
    'Does the response verify that clerkMiddleware() is used in middleware.ts?',
  ),
  verifies_clerk_provider: judge(
    'Does the response verify that <ClerkProvider> wraps the app in app/layout.tsx?',
  ),
  verifies_imports: judge(
    'Does the response verify that imports are from @clerk/nextjs or @clerk/nextjs/server?',
  ),
  verifies_app_router: judge(
    'Does the response verify that the App Router (not pages router) is being used?',
  ),
})
