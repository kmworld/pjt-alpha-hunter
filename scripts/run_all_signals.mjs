// scripts/run_all_signals.mjs
// Orchestrator: runs all 6 signal scripts sequentially,
// logs each step, continues on failure, and writes a run summary JSON.
// Node 22+ built-in only. No npm installs.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const SCRIPTS = [
  {
    name: "github_trending",
    file: "scripts/github_trending.mjs",
  },
  {
    name: "hn_signals",
    file: "scripts/hn_signals.mjs",
  },
  {
    name: "reddit_signals",
    file: "scripts/reddit_signals.mjs",
  },
  {
    name: "research_ml_signals",
    file: "scripts/research_ml_signals.mjs",
  },
  {
    name: "product_launch_signals",
    file: "scripts/product_launch_signals.mjs",
  },
  {
    name: "job_signals",
    file: "scripts/job_signals.mjs",
  },
];

function todayISODate() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function runScript(script) {
  const cmd = `node "${script.file}"`;
  console.log(`[run_all] Running: ${cmd}`);
  try {
    const out = execSync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 180_000, // 3 min per script
      encoding: "utf-8",
    });
    console.log(`[run_all] ${script.name}: OK`);
    console.log(`[run_all] ${script.name} stdout:`);
    console.log(out.trimEnd());
    return {
      status: "ok",
      file: null, // we can enrich later if needed
    };
  } catch (err) {
    const msg = err.message || String(err);
    console.error(`[run_all] ${script.name}: FAILED`);
    console.error(`[run_all] ${script.name} error:`, msg.trimEnd());
    return {
      status: "fail",
      file: null,
      error: msg.slice(0, 500),
    };
  }
}

function main() {
  const date = todayISODate();
  const runAt = new Date().toISOString();

  console.log(`[run_all] Alpha Hunter daily run — ${date}`);
  console.log(`[run_all] Project root: ${PROJECT_ROOT}`);

  const scripts = {};

  for (const script of SCRIPTS) {
    scripts[script.name] = runScript(script);
  }

  const summary = {
    date,
    runAt,
    scripts,
  };

  const dataDir = path.join(PROJECT_ROOT, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const summaryFile = path.join(dataDir, `alpha_run_summary_${date}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2), "utf-8");

  console.log(`[run_all] Summary written to: ${summaryFile}`);

  // Count ok/fail
  const ok = Object.values(scripts).filter(s => s.status === "ok").length;
  const fail = Object.values(scripts).filter(s => s.status === "fail").length;
  console.log(`[run_all] Done. OK: ${ok}, Failed: ${fail}`);

  // Exit 0 as long as run completed (even if some scripts failed)
  process.exit(0);
}

main();
