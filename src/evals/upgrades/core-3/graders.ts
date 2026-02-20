import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  // CLI upgrade tool recommendation
  cli_upgrade_tool: containsAny([
    'npx @clerk/upgrade',
    'pnpm dlx @clerk/upgrade',
    'yarn dlx @clerk/upgrade',
    'bunx @clerk/upgrade',
  ]),

  // Component replacements: SignedIn/SignedOut/Protect → Show
  show_component: containsAny(['<Show when=', '<Show']),
  show_signed_in: contains('when="signed-in"'),
  show_signed_out: contains('when="signed-out"'),

  // Package renames
  package_rename_react: contains('@clerk/react'),
  package_rename_expo: contains('@clerk/expo'),

  // Types import path change
  types_import_path: contains('@clerk/shared/types'),

  // Appearance prop: layout → options
  appearance_options: contains('appearance.options'),

  // Redirect prop replacements
  fallback_redirect: contains('fallbackRedirectUrl'),

  // SAML → enterprise_sso
  enterprise_sso: containsAny([
    'enterprise_sso',
    'enterpriseAccounts',
    'enterpriseAccount',
    'enterpriseSSO',
  ]),

  // client.activeSessions → client.sessions
  sessions_rename: contains('client.sessions'),

  // setActive: beforeEmit → navigate
  setactive_navigate: judge(
    'Does the solution mention replacing beforeEmit with navigate in the setActive callback, including the new signature with session and decorateUrl parameters?',
  ),

  // Next.js: ClerkProvider inside <body>
  clerk_provider_inside_body: judge(
    'Does the solution mention that ClerkProvider must be placed inside <body> rather than wrapping <html> in Next.js?',
  ),

  // useCheckout restructuring
  use_checkout_restructured: judge(
    'Does the solution mention that useCheckout return values are now nested under a checkout object (checkout.plan, checkout.status, checkout.start(), checkout.confirm())?',
  ),

  // Overall migration correctness
  overall_migration_correctness: judge(
    'Does the solution provide a comprehensive and accurate guide for upgrading from Clerk Core 2 to Core 3, recommending the CLI tool first and covering component replacements, package renames, appearance prop changes, and redirect prop removals?',
  ),
})
