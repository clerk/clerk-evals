Build a native Android app (Kotlin, Jetpack Compose) that handles Clerk session tokens for authenticated API calls with automatic retry and expiration handling. The publishable key is `pk_test_Y2xlcmsuaW5jbHVkZWQuZmF1biQxxxxxxx`.

## Requirements

1. Initialize Clerk in a custom `Application` subclass
2. After sign-in, retrieve the session token using Clerk's token API
3. Make an authenticated GET request to `https://api.example.com/me` with the token in the `Authorization: Bearer {token}` header
4. Implement token refresh retry: if the API returns 401, force-refresh the token and retry the request once
5. Handle session expiration: if the retry also fails, sign the user out and navigate to sign-in
6. Use OkHttp or Ktor as the HTTP client
7. Manage API call state in a ViewModel with distinct states for loading, success, and error
8. Display the API response data in the UI, with a "Refresh" button to re-trigger the call
9. Provide a "Sign Out" button
10. Use coroutines with proper dispatcher (IO for network, Main for UI) and try/catch error handling

Add `android.permission.INTERNET` in AndroidManifest.xml.

Do NOT make network calls on the main thread. All HTTP calls must use coroutines with appropriate dispatchers.
