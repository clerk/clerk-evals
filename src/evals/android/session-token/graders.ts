import { contains, containsAny, defineGraders, judge, matches } from '@/src/graders'

export const graders = defineGraders({
  initializes_in_application_class: matches(/class\s+\w+.*Application/),

  gets_session_token: containsAny(['getToken', 'sessionToken', 'session.getToken']),

  sets_auth_header: containsAny(['Authorization', 'Bearer']),

  uses_sealed_class_api_state: matches(/sealed\s+(class|interface)/),

  implements_401_retry: judge({
    criteria:
      'Does the code check for HTTP 401 responses and retry the request with a force-refreshed token before giving up?',
    examples:
      'PASS: Code checks `response.code == 401`, then calls `getToken(forceRefresh = true)` or `getToken(skipCache = true)`, rebuilds the request with the new token, and executes it again. If the retry also returns 401, it gives up.\nPASS: An OkHttp Interceptor inspects the response code. On 401, it closes the old response, refreshes the token, clones the request with the new Authorization header, and calls chain.proceed() again.\nFAIL: Code makes one HTTP request and if it gets 401, immediately shows an error or signs out without attempting a token refresh and retry.\nFAIL: Code refreshes the token on 401 but never actually retries the failed request — it just updates the stored token for future calls.',
  }),

  calls_force_refresh: containsAny(['forceRefresh', 'force_refresh', 'refresh']),

  handles_session_expiry_signout: judge({
    criteria:
      'If the token refresh retry also fails (second 401), does the code call signOut() and navigate or signal the user to the sign-in screen? Focus on whether signOut() is CALLED in the failure path, not whether the signOut method body is fully implemented.',
    examples:
      'PASS: After the retry request returns 401, code calls `clerk.signOut()` and navigates to the sign-in route, clearing the backstack.\nPASS: Code throws a SessionExpiredException on double-401, and the ViewModel catches it, calls signOut(), and emits a navigation event to sign-in.\nPASS: In the catch block after a failed token refresh, code sets error state "Session expired" and calls `signOut()`. Even if `signOut()` body is a stub or delegates to Clerk SDK, the call is present in the failure path.\nFAIL: Code detects double-401 but only shows a "Session expired" message without calling signOut() — the user must manually sign out.\nFAIL: Code retries once on 401 but if the retry fails, it silently swallows the error with no signout or navigation.',
  }),

  uses_coroutines_with_dispatchers: containsAny(['Dispatchers.IO', 'withContext(Dispatchers']),

  uses_http_client: containsAny(['OkHttp', 'HttpClient', 'Ktor', 'Retrofit', 'okhttp3']),

  provides_signout: containsAny(['signOut', 'SignOut', 'sign_out']),

  no_todo_placeholders: judge({
    criteria:
      'Does the code implement actual HTTP client calls and token retrieval rather than placeholder functions with TODO comments or empty stubs?',
    examples:
      'PASS: Code creates OkHttpClient, builds Request objects with real URLs, calls client.newCall(request).execute(), and parses the JSON response body.\nPASS: Repository class uses Retrofit or Ktor with actual endpoint definitions and response handling in coroutine scope.\nFAIL: Functions contain `// TODO: make API call` or `// TODO: get token` with empty bodies or hardcoded return values.\nFAIL: HTTP client is declared but never used — functions return mock data like `UserData("John", "john@example.com")`.',
  }),
})
