Build a native Android app (Kotlin, Jetpack Compose) with authentication-aware navigation and deep link handling using Clerk. The publishable key is `pk_test_Y2xlcmsuaW5jbHVkZWQuZmF1biQxxxxxxx`.

## Requirements

1. Initialize Clerk in a custom `Application` subclass
2. Define a navigation graph with Jetpack Compose Navigation using at least five routes: sign-in, sign-up, dashboard, profile, admin
3. Register deep links for protected screens using the `myapp://` scheme (e.g., `myapp://dashboard`, `myapp://profile`, `myapp://admin`)
4. Create a navigation guard that observes Clerk's auth state and controls routing:
   - Show a loading screen while Clerk initializes
   - Redirect unauthenticated users to sign-in, clearing the backstack
   - Redirect non-admin users away from the admin route (check `publicMetadata` for role) and show a Toast notification
5. Handle cold-start deep links: when the app opens from a deep link while logged out, preserve the intended destination and navigate there after successful sign-in
6. Navigation side effects must be triggered inside `LaunchedEffect` blocks — never directly in composable scope
7. Add `<intent-filter>` blocks in AndroidManifest.xml for the `myapp://` scheme
8. The Profile screen must show the user's name, email, and a "Sign Out" button
9. Use a single `NavController` instance — do not create multiple controllers
10. The SignIn screen should accept a redirect destination parameter so it can navigate to the intended screen after authentication

Add `android.permission.INTERNET` in AndroidManifest.xml.

Do NOT call `navigate()` directly inside composable scope without wrapping it in a `LaunchedEffect` or effect handler.
