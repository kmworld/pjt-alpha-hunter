// scripts/alpha_git_commit.mjs
// Git add, commit, and push the daily Alpha Hunter report.
// Node 22+ built-in only. No npm installs.

import { execSync } from "child_process";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function todayISODate() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 60_000,
      ...opts,
    });
    return { ok: true, out: out.trimEnd() };
  } catch (err) {
    return { ok: false, out: (err.message || String(err)).trimEnd() };
  }
}

function main() {
  const date = todayISODate();

  console.log(`[alpha_git] Git commit & push for ${date}`);

  // 1) git add -A
  const addResult = run("git add -A");
  if (!addResult.ok) {
    console.error(`[alpha_git] git add failed:`, addResult.out);
  } else {
    console.log(`[alpha_git] git add -A OK`);
  }

  // 2) git status --porcelain (quick check if anything changed)
  const statusResult = run("git status --porcelain");
  if (!statusResult.ok || !statusResult.out) {
    console.log(`[alpha_git] No changes to commit or status check failed. Exiting.`);
    process.exit(0);
  }

  // 3) git commit
  const commitMsg = `daily: alpha hunter report ${date}`;
  const commitResult = run(`git commit -m "${commitMsg}"`);
  if (!commitResult.ok) {
    // No changes or commit error
    console.log(`[alpha_git] git commit result:`, commitResult.out);
  } else {
    console.log(`[alpha_git] git commit OK: ${commitMsg}`);
  }

  // 4) git push origin main (best-effort)
  const pushResult = run("git push origin main");
  if (!pushResult.ok) {
    console.error(`[alpha_git] git push failed (non-fatal):`, pushResult.out);
  } else {
    console.log(`[alpha_git] git push origin main OK`);
  }

  // Always exit 0; failures logged but do not block pipeline
  process.exit(0);
}

main();
