import { contains, containsAny, defineGraders, judge, not } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android_ui: contains('clerk-android-ui'),
  initializes_in_application_class: judge({
    criteria:
      'Does the code call Clerk.initialize() inside an Application subclass (onCreate), NOT inside a Composable function or Activity?',
    examples:
      'PASS: A class extending Application overrides onCreate() and calls Clerk.initialize(this) before super or setContent.\nPASS: ClerkAndroidApplication is referenced as the application class in AndroidManifest.xml.\nFAIL: Clerk.initialize() is called inside MainActivity.onCreate() or inside a @Composable function.\nFAIL: Clerk.initialize() is called in a LaunchedEffect or remember block.',
  }),
  gates_on_initialization: containsAny(['isInitialized', 'isLoaded', 'isClerkLoaded']),
  uses_reactive_user_state: containsAny(['userFlow', 'collectAsState', 'sessionFlow']),
  uses_authview: contains('AuthView'),
  uses_user_button: contains('UserButton'),
  uses_internet_permission: contains('android.permission.INTERNET'),
  no_custom_form_leak: not(containsAny(['signIn.create', 'attemptFirstFactor', 'signUp.create'])),
  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),
})
