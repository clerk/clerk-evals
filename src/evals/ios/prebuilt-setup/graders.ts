import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_ios_package: contains('clerk-ios'),

  imports_clerkkit: contains('ClerkKit'),

  imports_clerkkitui: contains('ClerkKitUI'),

  uses_authview: contains('AuthView'),

  wires_publishable_key: containsAny(['configure', 'publishableKey']),

  uses_prebuilt_components: judge(
    'Does the output set up a working prebuilt Clerk authentication flow using ClerkKitUI components like AuthView, with proper app configuration and key wiring?',
  ),
})
