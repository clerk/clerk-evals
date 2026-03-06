---
description: Analyze eval results — compare scores, find regressions, calculate MCP uplift
argument-hint: <analysis-type, e.g. "mcp uplift", "regression check", "model gpt-5 vs claude-opus-4-6", "cost report">
allowed-tools: Read, Bash(bun:*), Glob
---

# Analyze Eval Results

Compare evaluation results across runs, models, and modes to find regressions, calculate improvements, and generate reports.

## Input

`$ARGUMENTS` = Analysis type. Examples:
- `mcp uplift` — baseline vs MCP score comparison
- `skills uplift` — baseline vs Skills score comparison
- `regression check` — compare latest run against previous
- `model gpt-5 vs claude-opus-4-6` — head-to-head comparison
- `category billing` — deep-dive into one category
- `cost report` — token usage and cost analysis
- `error audit` — summarize evaluation errors

## Data Sources (in order of freshness)

### 1. SQLite Database (canonical)
**File**: `evals.db`

Query pattern:
```bash
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('evals.db');
const rows = db.query('SELECT * FROM results ORDER BY timestamp DESC LIMIT 50').all();
console.log(JSON.stringify(rows, null, 2));
"
```

**`results` table**:
| Column | Type | Description |
|--------|------|-------------|
| run_id | TEXT | e.g., `baseline-2026-03-05T18-30-45-123Z` |
| model | TEXT | Model name (e.g., `claude-opus-4-6`) |
| label | TEXT | Display name |
| framework | TEXT | `Next.js` or `iOS` |
| category | TEXT | `Auth`, `Billing`, etc. |
| value | REAL | Score 0.0-1.0 |
| tokens_in | INTEGER | Input tokens |
| tokens_out | INTEGER | Output tokens |
| cost_usd | REAL | Estimated cost |
| duration_ms | INTEGER | Wall-clock time |
| timestamp | TEXT | ISO timestamp |

**`errors` table**:
| Column | Type |
|--------|------|
| run_id | TEXT |
| model | TEXT |
| evaluation_path | TEXT |
| error_message | TEXT |
| stack_trace | TEXT |
| timestamp | TEXT |

### 2. Score JSON Files (exports)
| File | Mode | Contents |
|------|------|----------|
| `scores.json` | Baseline | Latest baseline run |
| `scores-mcp.json` | MCP | Latest MCP run |
| `scores-skills.json` | Skills | Latest skills run |
| `llm-scores.json` | Merged | Enhanced format with `mcpScore`, `improvement`, `skillsScore` fields |

### 3. Debug Artifacts
**Directory**: `debug-runs/{runId}/`
Per-eval JSON files with prompt, response, grader results, and tool calls.

### 4. Calibration Reference
**File**: `scores-before-judge-replacement.json` — snapshot from before LLM judges were replaced with code graders. Useful for validating that replacements didn't change scores.

## Score Interpretation

- Values are **0.0-1.0** (fraction of graders passed)
- Display as percentage: `0.833` = `83.3%`
- Color thresholds: green >= 80%, yellow >= 50%, red < 50%
- Category scores = average of evals within that category
- Overall score = average of all category scores for a model

## Analysis Types

### MCP/Skills Uplift
Compare `scores.json` vs `scores-mcp.json` (or `scores-skills.json`):
1. Read both files
2. Match by `model` + `category`
3. Calculate: `improvement = (mcp_score - baseline_score) / baseline_score * 100`
4. Present as table with arrows: `Auth: 65% -> 82% (+26%)`

### Regression Check
Query DB for two most recent run_ids per mode:
```sql
SELECT DISTINCT run_id FROM results WHERE run_id LIKE 'baseline-%' ORDER BY timestamp DESC LIMIT 2
```
Then compare per-model, per-category scores. Flag any drop > 5 percentage points.

### Model Comparison
Filter DB or JSON for two specific models, create a table:
```
Category        | Model A  | Model B  | Winner
Auth            | 83%      | 75%      | A (+8%)
Billing         | 67%      | 83%      | B (+16%)
```

### Category Deep-Dive
Show all models' scores for one category, plus individual eval scores:
```
Auth (2 evals)
  auth/protect:  GPT-5=75%  Opus-4.6=88%  Sonnet-4.5=63%
  auth/routes:   GPT-5=83%  Opus-4.6=92%  Sonnet-4.5=75%
```

### Cost Report
Aggregate from DB:
```sql
SELECT model, SUM(cost_usd) as total_cost, SUM(tokens_in + tokens_out) as total_tokens,
       AVG(value) as avg_score, AVG(duration_ms) as avg_duration
FROM results WHERE run_id LIKE 'baseline-%'
GROUP BY model ORDER BY total_cost DESC
```
Calculate cost-effectiveness: `score_per_dollar = avg_score / total_cost`

### Error Audit
```sql
SELECT model, evaluation_path, error_message, COUNT(*) as occurrences
FROM errors GROUP BY model, evaluation_path, error_message
ORDER BY occurrences DESC
```

## Your Task

1. Identify the analysis type from `$ARGUMENTS`
2. Read the relevant data sources
3. Compute metrics
4. Present as a formatted markdown table
5. Highlight key findings (biggest improvements, worst regressions, most expensive models)

## Output Format

Use markdown tables. Example:

```
## MCP Uplift Report (2026-03-05)

| Model | Baseline | MCP | Change |
|-------|----------|-----|--------|
| claude-opus-4-6 | 85% | 90% | +5.9% |
| gpt-5 | 72% | 78% | +8.3% |

**Key findings:**
- Biggest gain: gpt-5 on Billing (+25%)
- No regressions detected
- Total cost: $1.23 (baseline) + $2.45 (MCP)
```
