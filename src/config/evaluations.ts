import type { Evaluation } from '@/src/interfaces'

/**
 * Shared evaluations for baseline and MCP runners.
 *
 * Categories = Clerk product verticals (what feature area).
 * primaryCapability = behavioral dimension (what model skill is tested).
 *
 * Primary capability distribution (target: 3-8 evals each):
 *   api_knowledge      — 8  (quickstarts, auth, profile, org-url-sync)
 *   ui_composition     — 5  (sign-in, user-button, user-profile, org-switcher, checkout-new)
 *   webhook_integration— 7  (user-created, user-sync, notifications, membership, billing x3)
 *   framework_detection— 6  (ios/routing, android/routing, add-auth x4)
 *   negative_constraint— 3  (nextjs-app-router, keyless, react-vite)
 *   migration_reasoning— 1  (core-3) — thin, need more upgrade evals
 *   tool_composition   — 2  (reserved for future MCP-only evals)
 */
export const EVALUATIONS: Evaluation[] = [
  // ─── Quickstarts ──────────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Quickstarts',
    path: 'evals/quickstarts/nextjs',
    description:
      'Sets up Clerk in a Next.js App Router project with clerkMiddleware, ClerkProvider, Show/UserButton components, and env vars',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Quickstarts',
    path: 'evals/quickstarts/nextjs-app-router',
    description:
      'Sets up Clerk in Next.js App Router with keyless mode and proxy.ts — must use Show instead of deprecated SignedIn/SignedOut',
    primaryCapability: 'negative_constraint',
    capabilities: ['api_knowledge'],
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Quickstarts',
    path: 'evals/quickstarts/keyless',
    description:
      'Explains Clerk keyless mode setup — must NOT tell users to create accounts or set env vars',
    primaryCapability: 'negative_constraint',
    capabilities: ['api_knowledge'],
    source: 'coverage',
  },
  {
    framework: 'React',
    category: 'Quickstarts',
    path: 'evals/quickstarts/react-vite',
    description:
      'Integrates Clerk into React Vite — must use VITE_ prefix and never use frontendApi or old env patterns',
    primaryCapability: 'negative_constraint',
    capabilities: ['api_knowledge'],
    source: 'coverage',
  },

  // ─── Auth ─────────────────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Auth',
    path: 'evals/auth/protect',
    description:
      'Builds admin area with auth.protect() for org permissions, protected API route with 401/403/200 responses, and clerkMiddleware',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Auth',
    path: 'evals/auth/routes',
    description:
      'Creates protected API routes (GET /api/hello, GET /api/user) with Clerk auth returning current user or 404',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },

  // ─── User Management ─────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'User Management',
    path: 'evals/user-management/profile-page',
    description:
      'Combines server-side currentUser() with client-side useUser() and UserButton for a profile page with live updates',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },

  // ─── UI Components ───────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/sign-in-customization',
    description:
      'Customizes SignIn component appearance with brand colors, rounded corners, and custom logo via the appearance prop',
    primaryCapability: 'ui_composition',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/user-button-menu',
    description:
      'Extends UserButton with custom menu items including action handlers and navigation links with icons',
    primaryCapability: 'ui_composition',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/user-profile-embed',
    description:
      'Embeds UserProfile inline (not modal) with dark theme on a settings page gated to signed-in users',
    primaryCapability: 'ui_composition',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/organization-switcher',
    description:
      'Configures OrganizationSwitcher for B2B app with org slug URL redirect and hidden personal workspaces',
    primaryCapability: 'ui_composition',
    source: 'coverage',
  },

  // ─── Organizations ───────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Organizations',
    path: 'evals/organizations/url-sync',
    description:
      'Syncs Clerk organization slug with URL path for multi-tenant B2B routing (e.g. /orgs/acmecorp/dashboard)',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Organizations',
    path: 'evals/organizations/membership-webhook',
    description:
      'Handles organizationMembership.created and .deleted webhooks with verifyWebhook and proper 200/400 responses',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },

  // ─── Webhooks ─────────────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Webhooks',
    path: 'evals/webhooks/user-created',
    description:
      'Creates webhook endpoint using verifyWebhook from @clerk/backend/webhooks to handle user.created events',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Webhooks',
    path: 'evals/webhooks/user-sync',
    description:
      'Sets up webhook handler for user.updated and user.deleted events to keep local records in sync with Clerk',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Webhooks',
    path: 'evals/webhooks/notifications',
    description:
      'Implements webhook handler for email.created and sms.created events to intercept Clerk notification delivery',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },

  // ─── Upgrades ─────────────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Upgrades',
    path: 'evals/upgrades/core-3',
    description:
      'Tests Core 2 to Core 3 migration: @clerk/upgrade CLI usage, Show replacing SignedIn/SignedOut/Protect, and deprecated API removals',
    primaryCapability: 'migration_reasoning',
    capabilities: ['negative_constraint'],
    source: 'regression',
  },

  // ─── Billing ──────────────────────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Billing',
    path: 'evals/billing/checkout-new',
    description:
      'Builds checkout page with CheckoutProvider, useCheckout, PaymentElement, and the start/confirm/finalize flow for new payments',
    primaryCapability: 'ui_composition',
    capabilities: ['api_knowledge'],
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Billing',
    path: 'evals/billing/checkout-existing',
    description:
      'Implements checkout with usePaymentMethods to select existing saved payment methods and confirm via paymentSourceId',
    primaryCapability: 'webhook_integration',
    capabilities: ['api_knowledge'],
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Billing',
    path: 'evals/billing/events-webhook',
    description:
      'Handles subscriptionItem.freeTrialEnding and paymentAttempt.updated billing webhooks with status-dependent logging',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },
  {
    framework: 'Next.js',
    category: 'Billing',
    path: 'evals/billing/subscriptions-webhook',
    description:
      'Processes subscription.created and subscription.pastDue webhooks for billing system persistence',
    primaryCapability: 'webhook_integration',
    source: 'coverage',
  },

  // ─── iOS ──────────────────────────────────────────────────────
  {
    framework: 'iOS',
    category: 'Quickstarts',
    path: 'evals/ios/prebuilt-setup',
    description:
      'Adds Clerk auth to a SwiftUI iOS app using prebuilt UI components with a publishable key',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'iOS',
    category: 'Quickstarts',
    path: 'evals/ios/custom-setup',
    description:
      'Implements custom sign-in and sign-up screens in SwiftUI using ClerkKit API instead of prebuilt components',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'iOS',
    category: 'Auth',
    path: 'evals/ios/routing',
    description:
      'Tests whether models correctly identify an Expo project and avoid native iOS/SwiftUI patterns when targeting iOS',
    primaryCapability: 'framework_detection',
    capabilities: ['negative_constraint'],
    source: 'regression',
  },

  // ─── Android ──────────────────────────────────────────────────
  {
    framework: 'Android',
    category: 'Quickstarts',
    path: 'evals/android/prebuilt-setup',
    description:
      'Adds Clerk auth to a Kotlin/Jetpack Compose Android app using prebuilt UI components',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'Android',
    category: 'Quickstarts',
    path: 'evals/android/custom-setup',
    description:
      'Builds custom sign-in and sign-up screens in Kotlin/Jetpack Compose using the Clerk Android API directly',
    primaryCapability: 'api_knowledge',
    source: 'coverage',
  },
  {
    framework: 'Android',
    category: 'Auth',
    path: 'evals/android/routing',
    description:
      'Tests whether models correctly identify an Expo project and avoid native Android/Kotlin patterns',
    primaryCapability: 'framework_detection',
    capabilities: ['negative_constraint'],
    source: 'regression',
  },

  // ─── Add Auth (agent evals) ───────────────────────────────────
  {
    framework: 'Next.js',
    category: 'Add Auth',
    path: 'evals/add-auth',
    variant: 'nextjs',
    description:
      'Detects Next.js framework from project files and follows the official quickstart to add Clerk auth end-to-end',
    primaryCapability: 'framework_detection',
    capabilities: ['api_knowledge'],
    source: 'dogfooding',
  },
  {
    framework: 'React',
    category: 'Add Auth',
    path: 'evals/add-auth',
    variant: 'react',
    description:
      'Detects React (Vite) framework from project files and follows the official quickstart to add Clerk auth end-to-end',
    primaryCapability: 'framework_detection',
    capabilities: ['api_knowledge'],
    source: 'dogfooding',
  },
  {
    framework: 'Android',
    category: 'Add Auth',
    path: 'evals/add-auth',
    variant: 'android',
    description:
      'Detects Android (Kotlin) framework from build.gradle.kts and follows the official quickstart to add Clerk auth',
    primaryCapability: 'framework_detection',
    capabilities: ['api_knowledge'],
    source: 'dogfooding',
  },
  {
    framework: 'iOS',
    category: 'Add Auth',
    path: 'evals/add-auth',
    variant: 'ios',
    description:
      'Detects iOS (SwiftUI) framework from Package.swift and follows the official quickstart to add Clerk auth',
    primaryCapability: 'framework_detection',
    capabilities: ['api_knowledge'],
    source: 'dogfooding',
  },
]
