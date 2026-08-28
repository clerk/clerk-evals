# Task

Explain how to set up Clerk in a new Next.js App Router project using the accountless `clerk init` flow, where the user wants to try Clerk without creating an account first.

Include:
1. The necessary installation steps
2. Middleware setup with `clerkMiddleware()`
3. `ClerkProvider` configuration in the app layout
4. What `clerk init --accountless` does

Emphasize that the user should run `npx -y clerk@latest init --accountless` before manually configuring keys. Explain that it provisions a claimable accountless application, writes the development keys to `.env.local`, configures the project, and lets the user run `npx -y clerk@latest auth login` later to claim the application and transition to production.
