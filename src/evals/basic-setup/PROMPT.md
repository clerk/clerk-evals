# Task

Set up a new React application with Openfort embedded wallet infrastructure from scratch.

## Requirements

Create a basic React app that demonstrates the initial setup of Openfort with the following:

1. Install all required dependencies (`@openfort/react`, `wagmi`, `viem`, `@tanstack/react-query`)
2. Configure the providers correctly:
   - Set up Wagmi config using `getDefaultConfig` from `@openfort/react`
   - Configure QueryClient from TanStack Query
   - Set up OpenfortProvider with:
     - `publishableKey`
     - `walletConfig` with `shieldPublishableKey`
3. Wrap the application with the provider hierarchy (WagmiProvider > QueryClientProvider > OpenfortProvider)
4. Include basic usage with the `OpenfortButton` component
5. Provide clear instructions on environment variable setup

## Acceptance Criteria

- Code includes installation of `@openfort/react`, `wagmi`, `viem@^2.22.0`, and `@tanstack/react-query`
- Creates a `Providers` component that properly wraps WagmiProvider, QueryClientProvider, and OpenfortProvider
- Uses `getDefaultConfig` from `@openfort/react` to configure Wagmi
- Configures `OpenfortProvider` with `publishableKey` and `walletConfig.shieldPublishableKey`
- Demonstrates usage of `OpenfortButton` or similar UI component
- Mentions environment variables (OPENFORT_PUBLISHABLE_KEY, SHIELD_PUBLISHABLE_KEY)
- Uses React 18+ and TypeScript
- Code is production-ready and follows React best practices

