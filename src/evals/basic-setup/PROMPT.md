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