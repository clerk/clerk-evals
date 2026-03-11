import { contains, containsAny, defineGraders, judge, not } from '@/src/graders'

export const graders = defineGraders({
  // Basic: right package (api, not ui)
  references_clerk_android_api: contains('clerk-android-api'),

  // Correctness: init in Application class, not in a Composable
  initializes_in_application_class: judge({
    criteria:
      'Does the code call Clerk.initialize() inside an Application subclass (onCreate), NOT inside a Composable function or Activity?',
    examples:
      'PASS: A class extending Application overrides onCreate() and calls Clerk.initialize(this) before super or setContent.\nPASS: ClerkAndroidApplication is referenced as the application class in AndroidManifest.xml.\nFAIL: Clerk.initialize() is called inside MainActivity.onCreate() or inside a @Composable function.\nFAIL: Clerk.initialize() is called in a LaunchedEffect or remember block.',
  }),

  // Correctness: gates UI on isInitialized
  gates_on_initialization: containsAny(['isInitialized', 'isLoaded', 'isClerkLoaded']),

  // Correctness: drives state from Clerk flows, not one-shot
  uses_reactive_auth_state: containsAny(['userFlow', 'sessionFlow', 'collectAsState']),

  // Correctness: uses actual Clerk sign-in/sign-up APIs
  uses_clerk_auth_apis: containsAny([
    'signIn.create',
    'client.signIn',
    'signUp.create',
    'client.signUp',
    'attemptFirstFactor',
  ]),

  // Correctness: multi-step flow, not monolithic
  multi_step_flow: judge({
    criteria:
      'Does the code split sign-in/sign-up into explicit steps or states (identifier, password, verification) rather than one monolithic screen with all fields visible?',
    examples:
      'PASS: A sealed class or enum defines states like Identifier, Password, Verification. Each state renders a different composable. Transitions happen on API success.\nPASS: A ViewModel manages currentStep and the UI switches between SignInScreen, VerificationScreen based on step.\nFAIL: One composable shows email, password, and verification code fields all at once.\nFAIL: A single function handles everything with nested if/else for each field.',
  }),

  // Correctness: INTERNET permission
  uses_internet_permission: contains('android.permission.INTERNET'),

  // Correctness: does NOT import prebuilt UI (AuthView/UserButton)
  no_prebuilt_ui_leak: not(containsAny(['AuthView', 'UserButton', 'clerk-android-ui'])),

  // Correctness: wires publishable key
  wires_publishable_key: containsAny(['publishableKey', 'pk_test_']),

  // Correctness: separates concerns (ViewModel or state machine)
  separates_concerns: judge({
    criteria:
      'Does the code separate UI composables from auth logic using a ViewModel, state machine, or repository pattern — rather than putting Clerk API calls directly inside composable functions?',
    examples:
      'PASS: A ClerkAuthViewModel calls Clerk APIs in suspend functions. Composables observe state via StateFlow and call viewModel methods on button click.\nPASS: A repository class wraps Clerk API calls. A ViewModel uses the repository and exposes UI state.\nFAIL: @Composable functions directly call Clerk.signIn.create() inside onClick lambdas with no ViewModel.\nFAIL: All Clerk API calls live inside LaunchedEffect blocks in the composable.',
  }),
})
