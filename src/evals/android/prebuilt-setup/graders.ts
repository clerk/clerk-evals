import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android_package: containsAny(['clerk-android-ui', 'clerk-android']),

  uses_clerk_initialize: containsAny(['Clerk.initialize', 'ClerkAndroidApplication']),

  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),

  uses_authview: contains('AuthView'),

  uses_user_button: contains('UserButton'),

  uses_prebuilt_components: judge(
    'Does the output set up a working prebuilt Clerk authentication flow using clerk-android-ui components like AuthView and UserButton, with proper app initialization and publishable key wiring?',
  ),
})
