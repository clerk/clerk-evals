import { contains, containsAny, defineGraders, judge } from '@/src/graders'

export const graders = defineGraders({
  references_clerk_android: containsAny(['clerk-android', 'com.clerk']),
  initializes_in_application_class: judge({
    criteria:
      'Does the code call Clerk.initialize() inside an Application subclass (onCreate), NOT inside a Composable function or Activity?',
    examples:
      'PASS: A class extending Application overrides onCreate() and calls Clerk.initialize(this) before super or setContent.\nPASS: ClerkAndroidApplication is referenced as the application class in AndroidManifest.xml.\nFAIL: Clerk.initialize() is called inside MainActivity.onCreate() or inside a @Composable function.\nFAIL: Clerk.initialize() is called in a LaunchedEffect or remember block.',
  }),
  gates_on_initialization: containsAny(['isInitialized', 'isLoaded', 'isClerkLoaded']),
  uses_reactive_user_state: containsAny(['userFlow', 'collectAsState', 'sessionFlow']),
  uses_prebuilt_auth_ui: judge(
    'Does the solution use prebuilt Clerk UI components (AuthView, UserButton) for the authentication flow, rather than building custom sign-in/sign-up forms with signIn.create, attemptFirstFactor, or signUp.create?',
  ),
  uses_internet_permission: contains('android.permission.INTERNET'),
  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),
})
