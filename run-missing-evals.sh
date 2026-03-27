#!/bin/bash
# Run only the evals missing from the capability ranking.
# Uses Anthropic + OpenAI providers (12 models).
set -euo pipefail

cd "$(dirname "$0")"
source .env

MISSING_EVALS=(
  "auth/routes"
  "user-management/profile-page"
  "organizations/url-sync"
  "organizations/membership-webhook"
  "ui-components/sign-in-customization"
  "ui-components/user-button-menu"
  "ui-components/user-profile-embed"
  "ui-components/organization-switcher"
  "webhooks/user-created"
  "webhooks/user-sync"
  "webhooks/notifications"
  "billing/checkout-new"
  "billing/checkout-existing"
  "billing/events-webhook"
  "billing/subscriptions-webhook"
  "upgrades/core-3"
  "ios/routing"
  "android/routing"
)

PROVIDERS=("anthropic" "openai")
TOTAL=${#MISSING_EVALS[@]}

echo "=== Running $TOTAL missing evals across ${#PROVIDERS[@]} providers ==="
echo ""

COMPLETED=0
ERRORS=0

for provider in "${PROVIDERS[@]}"; do
  echo "--- Provider: $provider ---"
  for eval_path in "${MISSING_EVALS[@]}"; do
    COMPLETED=$((COMPLETED + 1))
    echo "[$COMPLETED] $provider: $eval_path"
    if bun src/index.ts --eval "$eval_path" --provider "$provider" 2>&1 | tail -5; then
      echo ""
    else
      ERRORS=$((ERRORS + 1))
      echo "[error] Failed: $provider / $eval_path"
      echo ""
    fi
  done
done

echo "=== Done: $COMPLETED runs, $ERRORS errors ==="
echo ""
echo "View results:"
echo "  bun run export:capabilities"
