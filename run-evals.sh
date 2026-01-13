#!/bin/bash
# Sequential eval runner with timeout and retry logic (macOS compatible)

TIMEOUT_SECONDS=180  # 3 min per model
MAX_RETRIES=2
MODELS=("Sonnet 4" "Sonnet 4.5" "Opus 4" "Opus 4.5" "GPT-4o" "GPT-5")

cd ~/Clerk/clerk-evals

# Track failures
declare -a FAILED_BASELINE=()
declare -a FAILED_MCP=()

# macOS-compatible timeout using perl
run_with_timeout() {
  local model="$1"
  local mode="$2"

  echo ""
  echo "=== [$mode] $model (timeout: ${TIMEOUT_SECONDS}s) ==="

  if [ "$mode" = "mcp" ]; then
    perl -e "alarm $TIMEOUT_SECONDS; exec @ARGV" bun start --mcp --model "$model"
  else
    perl -e "alarm $TIMEOUT_SECONDS; exec @ARGV" bun start --model "$model"
  fi
  return $?
}

# Run all models
for model in "${MODELS[@]}"; do
  # Baseline
  if ! run_with_timeout "$model" "baseline"; then
    echo "FAILED: $model baseline"
    FAILED_BASELINE+=("$model")
  fi

  # MCP
  if ! run_with_timeout "$model" "mcp"; then
    echo "FAILED: $model MCP"
    FAILED_MCP+=("$model")
  fi
done

# Retry failed ones
echo ""
echo "=== RETRY PHASE ==="

for attempt in $(seq 1 $MAX_RETRIES); do
  if [ ${#FAILED_BASELINE[@]} -eq 0 ] && [ ${#FAILED_MCP[@]} -eq 0 ]; then
    echo "No failures to retry!"
    break
  fi

  echo "Retry attempt $attempt/$MAX_RETRIES"

  # Retry baseline failures
  NEW_FAILED_BASELINE=()
  for model in "${FAILED_BASELINE[@]}"; do
    if ! run_with_timeout "$model" "baseline"; then
      NEW_FAILED_BASELINE+=("$model")
    fi
  done
  FAILED_BASELINE=("${NEW_FAILED_BASELINE[@]}")

  # Retry MCP failures
  NEW_FAILED_MCP=()
  for model in "${FAILED_MCP[@]}"; do
    if ! run_with_timeout "$model" "mcp"; then
      NEW_FAILED_MCP+=("$model")
    fi
  done
  FAILED_MCP=("${NEW_FAILED_MCP[@]}")
done

# Report
echo ""
echo "=== FINAL REPORT ==="
if [ ${#FAILED_BASELINE[@]} -gt 0 ]; then
  echo "Failed baseline: ${FAILED_BASELINE[*]}"
fi
if [ ${#FAILED_MCP[@]} -gt 0 ]; then
  echo "Failed MCP: ${FAILED_MCP[*]}"
fi
if [ ${#FAILED_BASELINE[@]} -eq 0 ] && [ ${#FAILED_MCP[@]} -eq 0 ]; then
  echo "All evals completed successfully!"
fi

# Export results
echo ""
echo "=== EXPORTING ==="
bun ./export-from-db.ts
bun merge-scores
cp llm-scores.json ~/Clerk/clerk/public/

echo ""
echo "Done! Check ~/Clerk/clerk/public/llm-scores.json"
