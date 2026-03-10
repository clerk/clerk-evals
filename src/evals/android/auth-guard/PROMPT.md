Build a native Android app (Kotlin, Jetpack Compose) with Clerk authentication that implements role-based access control with three screens. The publishable key is `pk_test_Y2xlcmsuaW5jbHVkZWQuZmF1biQxxxxxxx`.

## Requirements

1. Initialize Clerk in a custom `Application` subclass
2. Create three screens: **SignIn**, **Dashboard**, and **AdminSettings** — each as a separate composable function
3. If the user is NOT signed in, they should only see the SignIn screen. Protected screens must redirect to SignIn.
4. If the user IS signed in but does NOT have admin privileges (check `publicMetadata` for a "role" field), the AdminSettings screen should show a "Permission Denied" message with a "Go Back" button
5. If the user IS signed in AND has the admin role, show the full admin content with at least 3 admin setting items (e.g., "Manage Users", "Billing", "API Keys")
6. Manage auth state in a ViewModel — represent Loading, Unauthenticated, and Authenticated states distinctly
7. Gate the entire UI on Clerk SDK initialization — show a loading spinner before Clerk is ready
8. The Dashboard should display the user's name and email, and provide navigation to AdminSettings
9. Use Clerk's prebuilt `AuthView` for the SignIn screen, but build Dashboard and AdminSettings with custom composables
10. Add `android.permission.INTERNET` in AndroidManifest.xml

Do NOT use a single monolithic Activity with if/else chains. Each screen must be a separate composable function.
