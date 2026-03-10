import { contains, containsAny, defineGraders, judge, matches, not } from '@/src/graders'

export const graders = defineGraders({
  // Basic: right package
  references_clerk_android_ui: contains('clerk-android-ui'),

  // Correctness: init in Application class, not in a Composable
  initializes_in_application_class: judge({
    criteria:
      'Does the code call Clerk.initialize() inside an Application subclass (onCreate), NOT inside a Composable function or Activity?',
    examples:
      'PASS: A class extending Application overrides onCreate() and calls Clerk.initialize(this) before super or setContent.\nPASS: ClerkAndroidApplication is referenced as the application class in AndroidManifest.xml.\nFAIL: Clerk.initialize() is called inside MainActivity.onCreate() or inside a @Composable function.\nFAIL: Clerk.initialize() is called in a LaunchedEffect or remember block.',
  }),

  // Correctness: gates UI on isInitialized before rendering auth components
  gates_on_initialization: containsAny(['isInitialized', 'isLoaded', 'isClerkLoaded']),

  // Correctness: uses reactive userFlow, not one-shot checks
  uses_reactive_user_state: containsAny(['userFlow', 'collectAsState', 'sessionFlow']),

  // Correctness: uses AuthView for signed-out, UserButton for signed-in
  uses_authview: contains('AuthView'),
  uses_user_button: contains('UserButton'),

  // Correctness: INTERNET permission in manifest
  uses_internet_permission: contains('android.permission.INTERNET'),

  // Correctness: does NOT introduce custom sign-in form logic alongside prebuilt
  no_custom_form_leak: not(
    containsAny(['signIn.create', 'attemptFirstFactor', 'signUp.create']),
  ),

  // Correctness: wires the publishable key
  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),
})
