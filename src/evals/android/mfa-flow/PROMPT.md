Build a custom multi-factor authentication sign-in flow in a native Android app (Kotlin, Jetpack Compose) using Clerk's low-level Android API. The publishable key is `pk_test_Y2xlcmsuaW5jbHVkZWQuZmF1biQxxxxxxx`.

## Requirements

1. Use the `clerk-android-api` artifact (NOT `clerk-android-ui` prebuilt components) and initialize Clerk in a custom `Application` subclass
2. Build a multi-step sign-in flow that handles: email identification, password verification, and optional TOTP-based MFA — each as a separate screen/composable
3. Use the correct Clerk Android sign-in API calls for each step of the authentication flow
4. Handle the case where MFA is NOT enabled on the account — the flow should skip the MFA step and complete sign-in directly after password verification
5. After successful authentication, activate the session using the appropriate Clerk API
6. Show contextual error messages when each step fails (wrong email, wrong password, wrong code)
7. Manage the multi-step state in a ViewModel with proper state representation
8. Include navigation between steps (back button to return to previous step)
9. Prevent double-submission by disabling the button and showing a loading indicator during API calls
10. Add `android.permission.INTERNET` in AndroidManifest.xml

Do NOT use `AuthView` or any prebuilt Clerk UI components. The entire sign-in UI must be custom composables.
