#!/usr/bin/env node
// job_signals.mjs
// Collects job signals from YC Work at a Startup (primary) and Wellfound (fallback).
// Output: data/job_signals_<YYYY-MM-DD>.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const KEYWORDS = [
  "AI",
  "AI infra",
  "AI infrastructure",
  "agent",
  "agents",
  "AI Agents",
  "ZK",
  "zero-knowledge",
  "DePIN",
  "WebGPU",
  "edge AI",
  "LLM",
  "infra",
  "MLOps",
  "distributed systems",
  "systems engineer",
  "machine learning",
  "ML",
  "deep learning",
  "autonomous",
  "backend",
  "full stack",
  "DevOps",
  "SRE",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, label) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[${label}] HTTP ${res.status} on ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[${label}] Request error:`, err.message);
    return null;
  }
}

function extractTags(text) {
  const lower = (text || "").toLowerCase();
  const tags = new Set();
  for (const kw of KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      tags.add(kw);
    }
  }
  return [...tags];
}

// ---------- YC Work at a Startup (embedded JSON in HTML) ----------

async function fetchYCWorkAtStartup() {
  const html = await fetchText(
    "https://www.workatastartup.com/",
    "YC Work at a Startup"
  );
  if (!html) return [];

  // The HTML uses &quot; entities instead of literal quotes
  const marker = '&quot;jobs&quot;:[';
  const jobsStart = html.indexOf(marker);
  if (jobsStart === -1) {
    console.log("[YC] No jobs array found in HTML");
    return [];
  }

  // Find the actual [ character inside the marker
  const bracketStart = jobsStart + marker.lastIndexOf('[');

  // Find matching bracket by counting
  let depth = 0;
  let endIdx = -1;
  for (let i = bracketStart; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    console.log("[YC] No matching bracket for jobs array");
    return [];
  }

  // Extract and decode HTML entities
  const jobsJsonStr = html.slice(bracketStart, endIdx + 1);
  const decoded = jobsJsonStr
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2F;/g, '/');

  let rawJobs;
  try {
    rawJobs = JSON.parse(decoded);
  } catch (e) {
    console.error("[YC] Failed to parse jobs JSON:", e.message);
    return [];
  }

  if (!Array.isArray(rawJobs)) {
    console.log("[YC] jobs is not an array");
    return [];
  }

  const jobs = [];

  for (const j of rawJobs) {
    const title = j.title || "";
    const company = j.companyName || "";
    const location = j.location || "Remote";
    const oneLiner = j.companyOneLiner || "";
    const roleType = j.roleType || "";
    const salary = j.salary || "";
    const companyBatch = j.companyBatch || "";

    const tags = extractTags(
      `${title} ${company} ${oneLiner} ${roleType}`
    );

    if (!title || !company) continue;

    jobs.push({
      title,
      company,
      tags,
      location,
      salary,
      roleType,
      companyBatch,
      url: `https://www.workatastartup.com/job/${j.id}`,
    });
  }

  return jobs;
}

// ---------- Wellfound (fallback; 403 likely, try a couple queries) ----------

async function fetchWellfound() {
  const jobs = [];
  const queries = [
    "AI+infra",
    "AI+agent",
    "LLM",
    "AI",
  ];

  for (const q of queries) {
    const url = `https://wellfound.com/jobs?q=${q}&page=1`;
    const html = await fetchText(url, "Wellfound");
    if (!html) continue;

    // Parse job cards
    const jobLinks = [];
    const aRegex =
      /<a[^>]+href=["']\/jobs\/([^"']+?)["'][^>]*class=["'][^"']*job[^"']*["'][^>]*>(.*?)<\/a>/gis;
    let m;
    while ((m = aRegex.exec(html)) !== null) {
      const slug = (m[1] || "").trim();
      const content = (m[2] || "").trim();
      if (!slug || !content) continue;
      const text = content
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 10) continue;
      jobLinks.push({ slug, text });
    }

    for (const j of jobLinks) {
      const parts = j.text.split("\n").map((s) => s.trim()).filter(Boolean);
      const title = parts[0] || "";
      const company = parts[1] || "";
      const location = parts[2] || "Remote";
      const tags = extractTags(`${title} ${company} ${location}`);
      if (!title || !company) continue;

      jobs.push({
        title,
        company,
        tags,
        location,
        url: `https://wellfound.com/jobs/${j.slug}`,
      });

      await sleep(60);
    }

    await sleep(300);
  }

  // Deduplicate by url
  const seen = new Set();
  const unique = [];
  for (const j of jobs) {
    if (!seen.has(j.url)) {
      seen.add(j.url);
      unique.push(j);
    }
  }
  return unique;
}

// ---------- Main ----------

async function run() {
  const date = todayISO();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const allJobs = [];
  let anySuccess = false;

  // 1) YC Work at a Startup (primary)
  try {
    console.log("[Jobs] Fetching YC Work at a Startup...");
    const ycJobs = await fetchYCWorkAtStartup();
    console.log(`[Jobs] YC: ${ycJobs.length} jobs`);
    if (ycJobs.length > 0) {
      anySuccess = true;
      allJobs.push(...ycJobs);
    }
  } catch (err) {
    console.error("[Jobs] YC error:", err.message);
  }

  await sleep(400);

  // 2) Wellfound (fallback)
  try {
    console.log("[Jobs] Fetching Wellfound...");
    const wfJobs = await fetchWellfound();
    console.log(`[Jobs] Wellfound: ${wfJobs.length} jobs`);
    if (wfJobs.length > 0) {
      anySuccess = true;
      allJobs.push(...wfJobs);
    }
  } catch (err) {
    console.error("[Jobs] Wellfound error:", err.message);
  }

  if (!anySuccess) {
    console.error("[Jobs] All sources failed. Exiting.");
    process.exit(1);
  }

  const payload = {
    source: "job_signals",
    date,
    jobs: allJobs,
  };

  const outPath = path.join(dataDir, `job_signals_${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[Jobs] Wrote ${allJobs.length} jobs → ${outPath}`);
}

run().catch((err) => {
  console.error("[Jobs] Fatal error:", err);
  process.exit(1);
});
