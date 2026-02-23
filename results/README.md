# Evaluation Results

This directory contains versioned snapshots of evaluation results for historical tracking and comparison.

## File Structure

- `YYYY-MM-DD_description.json` - Evaluation results
- `YYYY-MM-DD_description_metadata.json` - Run metadata (git commit, timestamp, etc.)

## Workflow

### 1. Run Evaluations

```bash
# Run baseline evaluations
bun start --eval evals/quickstarts/nextjs

# Run with MCP support
bun start:mcp --eval evals/quickstarts/nextjs

# Run with Skills support
bun start:skills --eval evals/quickstarts/nextjs
```

### 2. Save Results

After running evaluations, save a versioned snapshot:

```bash
# Save with a descriptive name
bun run save-results "baseline nextjs quickstarts"

# Or use a custom description
bun run save-results "mcp with updated prompts"
```

This creates two files:
- `2026-02-21_baseline-nextjs-quickstarts.json` - The actual results
- `2026-02-21_baseline-nextjs-quickstarts_metadata.json` - Metadata (git commit, branch, timestamp)

### 3. Export to Notion (Optional)

Set up Notion integration:

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Create a database with these properties:
   - **Model** (title) - The model name
   - **Category** (select) - e.g., Quickstarts, Auth, Billing
   - **Framework** (select) - e.g., Next.js, React
   - **Score** (number, format: percent) - The evaluation score
   - **Mode** (select) - Baseline, MCP, Skills
   - **Run Date** (date) - When the eval was run
   - **Run ID** (text) - Unique identifier for the run
3. Share the database with your integration
4. Add to `.env`:
   ```
   NOTION_API_KEY=your_integration_token
   NOTION_DATABASE_ID=your_database_id
   ```

Then export:

```bash
# Export latest results
bun run export:notion

# Export specific run
bun run export:notion <run_id>
```

## Comparing Results

To compare two runs, simply open the JSON files and diff them:

```bash
# Using diff
diff results/2026-02-21_baseline.json results/2026-02-22_mcp.json

# Using git
git diff --no-index results/2026-02-21_baseline.json results/2026-02-22_mcp.json

# Using VS Code
code --diff results/2026-02-21_baseline.json results/2026-02-22_mcp.json
```

## Tracking Improvements Over Time

Keep snapshots over time to see how models improve:

```
results/
├── 2026-02-21_baseline-nextjs-quickstarts.json
├── 2026-02-28_baseline-nextjs-quickstarts.json
├── 2026-03-07_baseline-nextjs-quickstarts.json
└── 2026-03-14_baseline-nextjs-quickstarts.json
```

## Best Practices

1. **Descriptive names** - Use clear descriptions that explain what's being tested
2. **Regular snapshots** - Save results after significant changes
3. **Document changes** - Use metadata files to track what changed between runs
4. **Compare carefully** - When comparing, ensure you're comparing like-with-like (same eval set, same mode)
