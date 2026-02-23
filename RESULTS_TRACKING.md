# Evaluation Results Tracking Setup

This project now has a complete system for tracking, versioning, and sharing evaluation results.

## Quick Start

### 1. Run an evaluation

```bash
bun start --eval evals/quickstarts/nextjs
```

### 2. Save the results

```bash
bun run save-results "baseline nextjs quickstarts"
```

This saves:
- `results/2026-02-22_baseline-nextjs-quickstarts.json` - The results
- `results/2026-02-22_baseline-nextjs-quickstarts_metadata.json` - Git commit, timestamp, etc.

### 3. Export to Notion (optional)

First, set up your Notion integration:

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name (e.g., "Clerk Evals")
4. Copy the "Internal Integration Token"
5. Create a database in Notion with these properties:

| Property | Type | Description |
|----------|------|-------------|
| Model | Title | The AI model name |
| Category | Select | e.g., Quickstarts, Auth, Billing |
| Framework | Select | e.g., Next.js, React |
| Score | Number (percent) | The evaluation score |
| Mode | Select | Baseline, MCP, or Skills |
| Run Date | Date | When the eval was run |
| Run ID | Text | Unique identifier |

6. Share the database with your integration (click "..." → "Connections" → Add your integration)
7. Get the database ID from the URL (it's the long string after the workspace name and before the "?v=")
8. Add to your `.env` file:

```bash
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then export:

```bash
bun run export:notion
```

## What Got Fixed

### Before
- Database was in `/tmp/` (gets deleted on reboot)
- No way to compare results over time
- No version tracking
- Results only in JSON files

### After
- Database in project folder (`evals.db`)
- Versioned snapshots in `results/` directory
- Git commit tracking in metadata
- One-command export to Notion for team sharing

## Available Commands

```bash
# Run evaluations
bun start --eval <path>           # Baseline
bun start:mcp --eval <path>       # With MCP tools
bun start:skills --eval <path>    # With Skills

# Save results
bun run save-results "description"

# Export
bun run export                     # Export to JSON
bun run export:notion              # Export to Notion
```

## Comparing Results

### In Terminal
```bash
diff results/2026-02-21_baseline.json results/2026-02-28_baseline.json
```

### In VS Code
```bash
code --diff results/2026-02-21_baseline.json results/2026-02-28_baseline.json
```

### In Notion
Filter by date, model, or category to see trends over time.

## File Structure

```
clerk-evals/
├── evals.db                      # SQLite database (persistent)
├── results/                      # Versioned snapshots
│   ├── README.md                 # Detailed documentation
│   ├── 2026-02-21_baseline_nextjs-quickstarts.json
│   └── 2026-02-21_baseline_nextjs-quickstarts_metadata.json
├── export-to-notion.ts           # Notion export script
├── save-results.ts               # Save versioned snapshots
└── RESULTS_TRACKING.md           # This file
```

## Troubleshooting

### "SQLite disk I/O error"
This was caused by macOS extended attributes on the project folder. We've removed these attributes and the database now works correctly.

### "Missing NOTION_API_KEY"
You need to set up the Notion integration first (see step 3 above).

### "No results found"
Make sure you've run an evaluation first with `bun start --eval <path>`.

## Next Steps

Consider adding:
- Automated comparison script (show improvements/regressions)
- Trend visualization dashboard
- CI/CD integration to run on every commit
- Performance benchmarks and regression alerts

See `results/README.md` for more details.
