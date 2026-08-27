# Task

Explain how to set up Clerk in a new Next.js App Router project using the accountless `clerk init` flow, where the user wants to try Clerk without creating an account first.

Include:
1. The necessary installation steps
2. Middleware setup with `clerkMiddleware()`
3. `ClerkProvider` configuration in the app layout
4. What `clerk init` does when the user is signed out

Emphasize that the user should run `npx -y clerk@latest init` before manually configuring keys. Explain that it provisions a claimable accountless application, writes the development keys to `.env`, configures the project, and lets the user sign in later to claim the application and transition to production.
