import { contains, defineGraders, judge, matches } from '@/src/graders'
import { authUIChecks, llmChecks } from '@/src/graders/catalog'

export const graders = defineGraders({
  // The fixture pins next@15 → the CLI scaffolds middleware.ts (proxy.ts is Next 16+).
  // If the fixture's Next version bumps, update this check.
  middleware_file: contains('middleware.ts'),
  // Quote-agnostic: the CLI scaffolds double quotes, handwritten code often single
  clerk_middleware_import: matches(/from ['"]@clerk\/nextjs\/server['"]/),
  clerk_middleware_usage: contains('clerkMiddleware'),
  clerk_provider_usage: contains('<ClerkProvider'),
  layout_file: contains('app/layout.tsx'),
  clerk_nextjs_package: contains('@clerk/nextjs'),
  package_json_clerk_version: llmChecks.packageJsonClerkVersion,
  uses_signed_in: authUIChecks.usesSignedIn,
  uses_signed_out: authUIChecks.usesSignedOut,
  uses_user_button: authUIChecks.usesUserButton,
  no_deprecated_patterns: judge(
    'Does the solution use clerkMiddleware (not the deprecated authMiddleware) and App Router (not the pages router with _app.tsx)? It is OK to mention deprecated patterns in warnings — only fail if the code actually uses them.',
  ),
})
