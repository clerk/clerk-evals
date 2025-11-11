# Task

Implement authentication in a React application using Openfort with multiple authentication providers.

## Requirements

Create a React app that demonstrates authentication using Openfort's embedded wallet with support for:

1. Multiple authentication providers:
   - Email authentication
   - Social login (e.g., Google, Facebook, Twitter)
   - Guest/anonymous authentication
   - Wallet-based authentication
2. Configure the `uiConfig.authProviders` array in OpenfortProvider
3. Use the `OpenfortButton` component or equivalent to trigger authentication
4. Demonstrate how to check authentication state
5. Show how to handle user login and logout

## Acceptance Criteria

- Configures OpenfortProvider with `uiConfig.authProviders` array
- Includes at least 3 different authentication providers (e.g., EMAIL, GOOGLE, GUEST, WALLET)
- Uses `AuthProvider` enum from `@openfort/react`
- Demonstrates authentication UI with `OpenfortButton` or custom implementation
- Shows how to access authentication state (e.g., using hooks like `useAuth` or similar)
- Includes proper TypeScript types
- Provides clear examples of login/logout flows
- Code follows React and Openfort best practices

