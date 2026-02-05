#!/bin/bash
# Sequential eval runner with timeout, retry logic, and model filtering (macOS compatible)

TIMEOUT_SECONDS=300  # 5 min per model (16 evals each)
MAX_RETRIES=2

ALL_MODELS=(
  "claude-sonnet-4-0"
  "claude-sonnet-4-5"
  "claude-opus-4-0"
  "claude-opus-4-5"
  "claude-opus-4-6"
  "claude-haiku-4-5"
  "gpt-4o"
  "gpt-5"
  "gpt-5-chat-latest"
  "gpt-5.2"
  "gpt-5.2-codex"
  "gemini-2.5-flash"
  "gemini-3-pro-preview"
  "v0-1.5-md"
  "v0-1.5-lg"
)

# Usage
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --models \"Model1,Model2\"   Run specific models (comma-separated)"
  echo "  --baseline-only            Only run baseline evals (no MCP)"
  echo "  --mcp-only                 Only run MCP evals (no baseline)"
  echo "  --no-export                Skip export step"
  echo "  --list                     List all available models"
  echo "  --help                     Show this help"
  echo ""
  echo "Examples:"
  echo "  $0"
  echo "  $0 --models \"gpt-5.2,gpt-5.2-codex\""
  echo "  $0 --models \"claude-sonnet-4-0\" --baseline-only"
  echo "  $0 --mcp-only"
}

# Parse arguments
FILTER=""
RUN_BASELINE=true
RUN_MCP=true
DO_EXPORT=true

while [[ $# -gt 0 ]]; do
  case $1 in
    --models)
      FILTER="$2"
      shift 2
      ;;
    --baseline-only)
      RUN_MCP=false
      shift
      ;;
    --mcp-only)
      RUN_BASELINE=false
      shift
      ;;
    --no-export)
      DO_EXPORT=false
      shift
      ;;
    --list)
      echo "Available models:"
      for m in "${ALL_MODELS[@]}"; do
        echo "  - $m"
      done
      exit 0
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Filter models based on --models argument (exact match, case-sensitive)
MODELS=()
if [ -n "$FILTER" ]; then
  IFS=',' read -ra FILTER_PARTS <<< "$FILTER"
  for part in "${FILTER_PARTS[@]}"; do
    part=$(echo "$part" | xargs)  # Trim whitespace
    for model in "${ALL_MODELS[@]}"; do
      if [[ "$model" == "$part" ]]; then
        MODELS+=("$model")
        break
      fi
    done
  done

  if [ ${#MODELS[@]} -eq 0 ]; then
    echo "No models matched: $FILTER"
    echo "Use --list to see available models"
    exit 1
  fi
else
  MODELS=("${ALL_MODELS[@]}")
fi

cd ~/Clerk/clerk-evals

# Show what we're running
echo "=== EVAL RUN CONFIGURATION ==="
echo "Models: ${MODELS[*]}"
echo "Baseline: $RUN_BASELINE"
echo "MCP: $RUN_MCP"
echo "Export: $DO_EXPORT"
echo ""

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

# Run selected models
for model in "${MODELS[@]}"; do
  # Baseline
  if [ "$RUN_BASELINE" = true ]; then
    if ! run_with_timeout "$model" "baseline"; then
      echo "FAILED: $model baseline"
      FAILED_BASELINE+=("$model")
    fi
  fi

  # MCP
  if [ "$RUN_MCP" = true ]; then
    if ! run_with_timeout "$model" "mcp"; then
      echo "FAILED: $model MCP"
      FAILED_MCP+=("$model")
    fi
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
  if [ "$RUN_BASELINE" = true ]; then
    NEW_FAILED_BASELINE=()
    for model in "${FAILED_BASELINE[@]}"; do
      if ! run_with_timeout "$model" "baseline"; then
        NEW_FAILED_BASELINE+=("$model")
      fi
    done
    FAILED_BASELINE=("${NEW_FAILED_BASELINE[@]}")
  fi

  # Retry MCP failures
  if [ "$RUN_MCP" = true ]; then
    NEW_FAILED_MCP=()
    for model in "${FAILED_MCP[@]}"; do
      if ! run_with_timeout "$model" "mcp"; then
        NEW_FAILED_MCP+=("$model")
      fi
    done
    FAILED_MCP=("${NEW_FAILED_MCP[@]}")
  fi
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
if [ "$DO_EXPORT" = true ]; then
  echo ""
  echo "=== EXPORTING ==="
  bun export-from-db.ts
  bun merge-scores
  cp llm-scores.json ~/Clerk/clerk/public/
  echo ""
  echo "Done! Check ~/Clerk/clerk/public/llm-scores.json"
else
  echo ""
  echo "Skipping export (use without --no-export to export)"
fi
