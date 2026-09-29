# Upgrade this application to Clerk Core 3

Upgrade the existing Next.js application from Clerk Core 2 to Clerk Core 3.

Start with the Clerk upgrade CLI. Detect the package manager from the repository lockfile and run the matching `@clerk/upgrade` command. If the CLI is not available, complete the same migration manually.

Inspect the whole repository after the CLI finishes. Complete any changes that the CLI missed. Keep the application behavior and its existing exported functions.

The upgraded application must:

- use Clerk Core 3 packages and supported runtime versions
- keep the signed-in, signed-out, and organization billing controls working
- keep sign-in and sign-up fallback redirects working
- list the user's other sessions
- switch sessions and navigate to the decorated dashboard URL
- place `ClerkProvider` correctly in the Next.js root layout
- contain no Clerk Core 2 API usage

Run the available checks before completion. Edit the repository. Do not only provide an upgrade guide.
