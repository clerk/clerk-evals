import { Database } from "bun:sqlite";
import fs from "node:fs";

const db = new Database("evals.db");

interface DBRow {
  model: string;
  label: string;
  framework: string;
  category: string;
  value: number;
  updatedAt: string;
}

interface Score {
  model: string;
  label: string;
  framework: string;
  category: string;
  value: number;
  updatedAt: string;
}

// Get ALL results
const query = db.query(`
  SELECT model, label, framework, category, value, timestamp as updatedAt
  FROM results
  ORDER BY timestamp DESC
`);

const allResults = query.all() as DBRow[];

console.log(`Total rows in DB: ${allResults.length}`);

// Group by model+category+framework, take the highest score
const scoreMap = new Map<string, Score>();
for (const r of allResults) {
  const key = `${r.model}:${r.category}:${r.framework}`;
  const existing = scoreMap.get(key);
  if (!existing || r.value > existing.value) {
    scoreMap.set(key, { ...r });
  }
}

const uniqueScores = Array.from(scoreMap.values());
console.log(`Unique model+category+framework combinations: ${uniqueScores.length}`);

// Split into baseline and MCP based on label suffix "(MCP)"
const baseline = uniqueScores.filter((r) => !r.label.includes("(MCP)"));
const mcp = uniqueScores.filter((r) => r.label.includes("(MCP)"));

console.log(`Baseline scores: ${baseline.length}`);
console.log(`MCP scores: ${mcp.length}`);

// Show breakdown by model
const modelCounts = new Map<string, number>();
for (const s of uniqueScores) {
  const count = modelCounts.get(s.label) || 0;
  modelCounts.set(s.label, count + 1);
}
console.log("\nScores per model:");
for (const [model, count] of modelCounts.entries()) {
  console.log(`  ${model}: ${count}`);
}

fs.writeFileSync("scores.json", JSON.stringify(baseline, null, 2));
fs.writeFileSync("scores-mcp.json", JSON.stringify(mcp, null, 2));

console.log("\nExported to scores.json and scores-mcp.json");
