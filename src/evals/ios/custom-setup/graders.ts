import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_ios_package: contains('clerk-ios'),

  imports_clerkkit: contains('ClerkKit'),

  wires_publishable_key: containsAny(['configure', 'publishableKey']),

  uses_clerk_auth_apis: containsAny(['signIn', 'signUp', 'SignIn', 'SignUp']),

  configures_associated_domain: containsAny([
    'webcredentials',
    'associated-domain',
    'Associated Domains',
  ]),

  custom_flow_quality: judge(
    'Does the output implement a custom Clerk auth flow using ClerkKit primitives with a multi-step progression (separate screens or states for sign-in, sign-up, verification) rather than a single monolithic screen?',
  ),
})
