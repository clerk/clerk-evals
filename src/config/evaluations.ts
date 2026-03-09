import type { Evaluation } from '@/src/interfaces'

/**
 * Shared evaluations for baseline and MCP runners.
 * Categories aligned with Openfort product verticals.
 */
export const EVALUATIONS: Evaluation[] = [
  // Openfort (8 evals)
  { framework: 'React', category: 'Setup', path: 'evals/basic-setup' },
  { framework: 'React', category: 'Authentication', path: 'evals/authentication' },
  { framework: 'React', category: 'Embedded Wallets', path: 'evals/embedded-wallets' },
  { framework: 'React', category: 'Wallet Recovery', path: 'evals/wallet-recovery' },
  { framework: 'React', category: 'Wallet Actions', path: 'evals/wallet-actions' },
  { framework: 'React', category: 'Hooks', path: 'evals/hooks-usage' },
  { framework: 'Next.js', category: 'Sponsor Transactions', path: 'evals/sponsor-tx' },
  { framework: 'Next.js', category: 'Backend Wallets', path: 'evals/backend-wallets' },
]
