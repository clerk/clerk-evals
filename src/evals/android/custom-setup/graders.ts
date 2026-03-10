import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android_package: containsAny(['clerk-android-api', 'clerk-android']),

  uses_clerk_initialize: containsAny(['Clerk.initialize', 'ClerkAndroidApplication']),

  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),

  uses_clerk_auth_apis: containsAny([
    'signIn.create',
    'client.signIn',
    'SignIn(',
    'signUp.create',
    'client.signUp',
    'SignUp(',
    'attemptFirstFactor',
  ]),

  uses_internet_permission: contains('android.permission.INTERNET'),

  custom_flow_quality: judge({
    criteria:
      'Does the output implement a custom Clerk auth flow using clerk-android-api primitives with a multi-step progression (separate screens or states for sign-in, sign-up, verification) rather than a single monolithic screen?',
    examples:
      'PASS: Code defines separate composables or sealed class states for sign-in, sign-up, and email verification. Each step has its own UI and calls distinct Clerk APIs (signIn.create, signUp.create, attemptVerification). Navigation between steps uses state transitions.\nPASS: A ViewModel manages a state machine with states like Identifier, Password, Verification, each rendered by different composable functions.\nFAIL: A single composable contains all form fields (email, password, verification code) visible at once with no step progression.\nFAIL: Code uses a single screen with if/else to show different fields but the logic is all in one monolithic function with no state separation.',
  }),
})
