Build a native Android app (Kotlin, Jetpack Compose) that implements Clerk organization switching with a reactive UI. The publishable key is `pk_test_Y2xlcmsuaW5jbHVkZWQuZmF1biQxxxxxxx`.

## Requirements

1. Initialize Clerk in a custom `Application` subclass
2. After sign-in, fetch and display the user's organization memberships showing each org's name and the user's role
3. Allow the user to tap an organization to switch the active organization using Clerk's API
4. Store the active organization state in a ViewModel with `StateFlow` so the UI recomposes reactively when the org changes
5. Display the currently active organization prominently in a top bar or header
6. When the active org changes, update an authorization context (show "Active Org: {name} (ID: {id})" in the UI)
7. Handle the empty state: if the user has no organizations, show a helpful message instead of a blank screen
8. Show a loading indicator while fetching organization memberships
9. Provide a "Sign Out" button that signs out and returns to sign-in
10. Use `collectAsState()` or similar for reactive state collection — do not poll or manually refresh the UI

Add `android.permission.INTERNET` in AndroidManifest.xml.

The key challenge: synchronize Clerk's organization state with your local ViewModel state and ensure the UI updates reactively.
