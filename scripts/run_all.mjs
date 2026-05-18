// scripts/run_all.mjs
// Improved orchestrator: parallel data collection → sequential analysis → commit.
// Node 22+ built-in only. No npm installs.

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// ===================== Phase definitions =====================

// Phase 1: Independent data collection (run in parallel)
const PHASE_1 = [
  { name: "github_trending",  file: "scripts/github_trending.mjs" },
  { name: "hn_signals",       file: "scripts/hn_signals.mjs" },
  { name: "reddit_signals",   file: "scripts/reddit_signals.mjs" },
  { name: "research_ml",      file: "scripts/research_ml_signals.mjs" },
  { name: "product_launch",   file: "scripts/product_launch_signals.mjs" },
  { name: "job_signals",      file: "scripts/job_signals.mjs" },
];

// Phase 2: Deep context (depends on all Phase 1 data)
const PHASE_2 = [
  { name: "alpha_deep_context", file: "scripts/alpha_deep_context.mjs" },
];

// Phase 3: Report + commit (depends on deep context)
const PHASE_3 = [
  { name: "alpha_daily_report", file: "scripts/alpha_daily_report.mjs" },
  { name: "alpha_git_commit",   file: "scripts/alpha_git_commit.mjs" },
];

// ===================== Helpers =====================

function todayISODate() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function runScript(script) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const result = { name: script.name, status: "pending", duration_ms: 0 };

    console.log(`[run_all] ▶ ${script.name}`);

    const child = spawn("node", [script.file], {
      cwd: PROJECT_ROOT,
      timeout: 180_000, // 3 min per script
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      result.duration_ms = Date.now() - startTime;

      if (code === 0) {
        result.status = "ok";
        console.log(`[run_all] ✓ ${script.name} (${result.duration_ms}ms)`);
        const trimmed = stdout.trim();
        if (trimmed) console.log(`[run_all]   ${trimmed.split("\n").slice(0, 3).join("\n")}`);
      } else {
        result.status = "fail";
        result.error = (stderr || stdout).trim().slice(0, 500);
        console.error(`[run_all] ✗ ${script.name} (exit ${code}, ${result.duration_ms}ms)`);
        console.error(`[run_all]   ${result.error.split("\n").slice(0, 3).join("\n")}`);
      }

      resolve(result);
    });

    child.on("error", (err) => {
      result.status = "fail";
      result.error = err.message || String(err);
      result.duration_ms = Date.now() - startTime;
      console.error(`[run_all] ✗ ${script.name} (spawn error: ${result.error})`);
      resolve(result);
    });
  });
}

async function runPhase(phase, label) {
  console.log(`\n[run_all] === ${label} ===`);
  const results = await Promise.all(phase.map(runScript));
  console.log(`[run_all] ${label}: ${results.filter(r => r.status === "ok").length}/${results.length} OK`);
  return results;
}

// ===================== Main =====================

async function main() {
  const date = todayISODate();
  const runAt = new Date().toISOString();

  console.log(`[run_all] Alpha Hunter daily run — ${date}`);
  console.log(`[run_all] Project root: ${PROJECT_ROOT}`);

  const allResults = [];

  // Phase 1: Parallel data collection
  const phase1 = await runPhase(PHASE_1, "Phase 1: Data Collection (parallel)");
  allResults.push(...phase1);

  // Phase 2: Deep context (sequential, depends on Phase 1)
  const phase2 = await runPhase(PHASE_2, "Phase 2: Deep Context Analysis");
  allResults.push(...phase2);

  // Phase 3: Report + Commit (parallel)
  const phase3 = await runPhase(PHASE_3, "Phase 3: Report & Commit (parallel)");
  allResults.push(...phase3);

  // ===================== Write Summary =====================

  const summary = {
    date,
    runAt,
    total_duration_ms: allResults.reduce((s, r) => s + (r.duration_ms || 0), 0),
    scripts: {},
  };

  for (const r of allResults) {
    summary.scripts[r.name] = {
      status: r.status,
      duration_ms: r.duration_ms,
      error: r.error || null,
    };
  }

  const dataDir = path.join(PROJECT_ROOT, "data");
  const dateDir = path.join(dataDir, date);
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  const summaryFile = path.join(dateDir, "alpha_run_summary.json");
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), "utf-8");

  // ===================== Final Stats =====================

  const ok = allResults.filter(r => r.status === "ok").length;
  const fail = allResults.filter(r => r.status === "fail").length;

  console.log(`\n[run_all] === SUMMARY ===`);
  console.log(`[run_all] OK: ${ok}, Failed: ${fail}`);
  console.log(`[run_all] Total duration: ${summary.total_duration_ms}ms`);
  console.log(`[run_all] Summary: ${summaryFile}`);

  process.exit(0);
}

main();
