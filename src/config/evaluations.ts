import type { Evaluation } from '@/src/interfaces'

/**
 * Shared evaluations for baseline and MCP runners.
 * Categories aligned with Clerk product verticals.
 */
export const EVALUATIONS: Evaluation[] = [
  // Quickstarts (4 evals)
  { framework: 'Next.js', category: 'Quickstarts', path: 'evals/quickstarts/nextjs' },
  {
    framework: 'Next.js',
    category: 'Quickstarts',
    path: 'evals/quickstarts/nextjs-app-router',
  },
  { framework: 'Next.js', category: 'Quickstarts', path: 'evals/quickstarts/keyless' },
  { framework: 'React', category: 'Quickstarts', path: 'evals/quickstarts/react-vite' },

  // Auth (2 evals)
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/protect' },
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/routes' },

  // User Management (1 eval)
  { framework: 'Next.js', category: 'User Management', path: 'evals/user-management/profile-page' },

  // UI Components (4 evals)
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/sign-in-customization',
  },
  { framework: 'Next.js', category: 'UI Components', path: 'evals/ui-components/user-button-menu' },
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/user-profile-embed',
  },
  {
    framework: 'Next.js',
    category: 'UI Components',
    path: 'evals/ui-components/organization-switcher',
  },

  // Organizations (2 evals)
  { framework: 'Next.js', category: 'Organizations', path: 'evals/organizations/url-sync' },
  {
    framework: 'Next.js',
    category: 'Organizations',
    path: 'evals/organizations/membership-webhook',
  },

  // Webhooks (3 evals)
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/user-created' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/user-sync' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/notifications' },

  // Billing (4 evals)
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-new' },
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-existing' },
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/events-webhook' },
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/subscriptions-webhook' },
]
