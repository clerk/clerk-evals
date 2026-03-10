import { contains, containsAny, defineGraders, judge, matches, not } from '@/src/graders'

export const graders = defineGraders({
  uses_clerk_api_package: containsAny(['clerk-android-api', 'clerk-android']),

  does_not_use_authview: not(contains('AuthView')),

  calls_signin_create: containsAny(['signIn.create', 'SignIn.create']),

  calls_attempt_first_factor: containsAny([
    'attemptFirstFactor',
    'attempt_first_factor',
  ]),

  calls_attempt_second_factor: containsAny([
    'attemptSecondFactor',
    'attempt_second_factor',
  ]),

  checks_signin_status_for_mfa: judge({
    criteria:
      'Does the code check the sign-in response status to determine whether MFA is required, and handle the case where MFA is not needed by completing sign-in directly?',
    examples:
      'PASS: After attemptFirstFactor, code checks `result.status == "needs_second_factor"` and branches — if true, transitions to MFA step; if "complete", calls setActive to finish sign-in.\nPASS: Code uses a `when` block on signIn.status with branches for "complete", "needs_second_factor", and an else/error case.\nFAIL: Code always transitions to the MFA screen after password entry, regardless of the sign-in status.\nFAIL: Code checks status but only handles "needs_second_factor" — if MFA is not required, the flow hangs with no completion logic.',
  }),

  uses_set_active_for_session: containsAny(['setActive', 'createdSessionId']),

  three_distinct_composables: judge({
    criteria:
      'Does the code implement three distinct @Composable functions — one for each step: identifier input, password entry, and MFA code — rather than one monolithic form with conditional field visibility?',
    examples:
      'PASS: Code defines `@Composable fun EmailScreen(...)`, `@Composable fun PasswordScreen(...)`, and `@Composable fun MfaScreen(...)` as three separate functions, each with their own parameters and UI.\nPASS: Three composables like IdentifierStep, PasswordStep, TotpStep are defined separately and selected via a when-block on the current step state.\nFAIL: A single @Composable function contains all three input fields, using `if (currentStep == ...)` to show/hide them within one function body.\nFAIL: Only two composables exist — password and MFA are merged into one screen with conditional visibility.',
  }),

  uses_sealed_class_state_machine: matches(/sealed\s+(class|interface)/),

  handles_errors_per_step: judge({
    criteria:
      'Does the code catch API errors at each step and display distinct error messages (not a generic "Something went wrong") for at least two of the three steps?',
    examples:
      'PASS: Email step catches exception and shows "Failed to verify email. Please check and try again." Password step catches and shows "Invalid password. Please try again." Each step has its own try-catch with a specific message.\nPASS: ViewModel has separate error handling in submitEmail(), submitPassword(), and submitMfaCode() with distinct messages like "Email not found" vs "Incorrect password" vs "Invalid verification code".\nFAIL: All steps share one generic catch block that shows "Something went wrong" for every error.\nFAIL: Only one step has error handling; other steps let exceptions propagate unhandled.',
  }),

  back_navigation_between_steps: containsAny(['onBack', 'goBack', 'Back', 'previousStep']),

  internet_permission: contains('android.permission.INTERNET'),
})
