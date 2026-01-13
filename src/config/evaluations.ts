import type { Evaluation } from '@/src/interfaces'

/**
 * Shared evaluations for baseline and MCP runners.
 */
export const EVALUATIONS: Evaluation[] = [
  // Quickstarts - getting started guides
  { framework: 'Next.js', category: 'Quickstarts', path: 'evals/quickstarts/nextjs' },
  { framework: 'React', category: 'Quickstarts', path: 'evals/quickstarts/react-vite' },
  // Auth
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/protect' },
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/routes' },
  { framework: 'Next.js', category: 'Auth', path: 'evals/auth/users' },
  // Billing
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-new' },
  { framework: 'Next.js', category: 'Billing', path: 'evals/billing/checkout-existing' },
  // Organizations
  { framework: 'Next.js', category: 'Organizations', path: 'evals/organizations/url-sync' },
  // Webhooks
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/auth/receive' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/auth/sync' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/billing/events' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/billing/subscriptions' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/organizations/membership' },
  { framework: 'Next.js', category: 'Webhooks', path: 'evals/webhooks/notifications' },
]
