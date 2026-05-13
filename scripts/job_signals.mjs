#!/usr/bin/env node
// job_signals.mjs
// Collects job signals from Wellfound and YC Work at a Startup.
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
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, label, extraHeaders) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      ...extraHeaders,
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

// Simple HTML text helpers
function stripTags(html) {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinksFromJobs(html) {
  const links = [];
  const aRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = aRegex.exec(html)) !== null) {
    const href = (m[1] || "").trim();
    const text = (m[2] || "").trim();
    if (href && text) links.push({ href, text });
  }
  return links;
}

// Tag extraction from job text
function extractTags(text) {
  const lower = text.toLowerCase();
  const tags = new Set();
  for (const kw of KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      tags.add(kw);
    }
  }
  return [...tags];
}

// ---------- Wellfound (AngelList) ----------

async function fetchWellfound() {
  const jobs = [];
  const queries = [
    "AI+infra",
    "AI+agent",
    "ZK",
    "DePIN",
    "edge+AI",
    "LLM",
  ];

  for (const q of queries) {
    const url = `https://wellfound.com/jobs?q=${q}&page=1`;
    const html = await fetchText(url, "Wellfound");
    if (!html) continue;

    // Parse job cards: each card has a link with job title and company
    // Typical pattern: <a class="..." href="/jobs/<id>-<slug>">
    const jobLinks = [];
    const aRegex =
      /<a[^>]+href=["']\/jobs\/([^"']+?)["'][^>]*class=["'][^"']*job[^"']*["'][^>]*>(.*?)<\/a>/gis;
    let m;
    while ((m = aRegex.exec(html)) !== null) {
      const slug = (m[1] || "").trim();
      const content = (m[2] || "").trim();
      if (!slug || !content) continue;
      const text = stripTags(content);
      // Skip if too short
      if (text.length < 10) continue;
      jobLinks.push({
        slug,
        text,
      });
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

      // Small delay to be polite
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

// ---------- YC Work at a Startup ----------

async function fetchYCWorkAtStartup() {
  const jobs = [];
  const html = await fetchText(
    "https://www.workatastartup.com/",
    "YC Work at a Startup"
  );
  if (!html) return jobs;

  // Look for job links: typically <a href="/job/<slug>" class="...">
  const jobLinks = [];
  const aRegex =
    /<a[^>]+href=["']\/job\/([^"']+?)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = aRegex.exec(html)) !== null) {
    const slug = (m[1] || "").trim();
    const content = (m[2] || "").trim();
    if (!slug || !content) continue;
    const text = stripTags(content);
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
      url: `https://www.workatastartup.com/job/${j.slug}`,
    });

    await sleep(60);
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

  // 1) Wellfound
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

  await sleep(400);

  // 2) YC Work at a Startup
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
