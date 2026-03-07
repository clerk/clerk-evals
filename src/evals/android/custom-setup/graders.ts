import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android_package: containsAny(['clerk-android-api', 'clerk-android']),

  uses_clerk_initialize: containsAny(['Clerk.initialize', 'ClerkAndroidApplication']),

  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),

  uses_clerk_auth_apis: containsAny(['signIn', 'signUp', 'SignIn', 'SignUp']),

  uses_internet_permission: contains('android.permission.INTERNET'),

  custom_flow_quality: judge(
    'Does the output implement a custom Clerk auth flow using clerk-android-api primitives with a multi-step progression (separate screens or states for sign-in, sign-up, verification) rather than a single monolithic screen?',
  ),
})
