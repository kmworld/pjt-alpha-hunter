#!/usr/bin/env node
// bigtech_ai_jobs.mjs
// Collect AI/ML/Agent job listings from Big Tech + AI hot companies.
// Approach: Use web search to find recent job postings, then extract details.
// Output: data/<YYYY-MM-DD>/bigtech_ai_jobs.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ===================== Target companies =====================

const COMPANIES = [
  { name: "Google", slug: "google" },
  { name: "Meta", slug: "meta" },
  { name: "OpenAI", slug: "openai" },
  { name: "Anthropic", slug: "anthropic" },
  { name: "xAI", slug: "xai" },
  { name: "Microsoft", slug: "microsoft" },
  { name: "Amazon", slug: "amazon" },
  { name: "Tesla", slug: "tesla" },
  { name: "Apple", slug: "apple" },
  { name: "Nvidia", slug: "nvidia" },
  { name: "Mistral AI", slug: "mistral" },
  { name: "Cohere", slug: "cohere" },
  { name: "Scale AI", slug: "scale_ai" },
  { name: "Databricks", slug: "databricks" },
  { name: "Snowflake", slug: "snowflake" },
];

// ===================== Fetch & Parse =====================

async function fetchText(url, label) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`[${label}] HTTP ${res.status} on ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[${label}] Error: ${err.message}`);
    return null;
  }
}

// ===================== Search-based job collection =====================

async function searchCompanyJobs(companyName, query) {
  // Search for recent job postings on Google
  const html = await fetchText(
    `https://www.google.com/search?q=${encodeURIComponent(query + " hiring 2025 2026")}&tbs=qdr:m`,
    `Search-${companyName}`
  );
  if (!html) return [];

  const jobs = [];

  // Extract job links from search results
  // Pattern: <a href="URL">Title</a>
  const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([^<]{20,200})<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    let url = match[1].trim();
    const title = match[2].trim();

    // Filter for actual job postings
    if (!/linkedin|indeed|glassdoor|career|job|hiring|apply/i.test(url + " " + title)) continue;

    // Skip Google internal pages
    if (/google\.com\/(about|search|url)/i.test(url)) continue;

    // Clean up Google redirect URLs
    if (/google\.com\/url/i.test(url)) {
      const qMatch = url.match(/&amp;q=([^&]*)/);
      if (qMatch) {
        try {
          url = decodeURIComponent(qMatch[1]);
        } catch { continue; }
      }
    }

    jobs.push({
      title: title.slice(0, 120),
      url,
      company: companyName,
    });
  }

  return jobs;
}

// ===================== Keyword extraction =====================

function extractKeySkills(title, context) {
  const text = `${title} ${context}`.toLowerCase();
  const skills = new Set();

  const skillMap = [
    "LLM", "Agent", "RAG", "Vector DB", "PyTorch", "TensorFlow", "JAX",
    "CUDA", "Transformer", "ML", "AI", "Deep Learning", "NLP", "Computer Vision",
    "Python", "TypeScript", "Go", "Rust", "Kubernetes", "Docker", "AWS", "GCP", "Azure",
    "vLLM", "Triton", "Fine-tuning", "RLHF", "DPO", "Inference", "Training",
    "Neural Network", "GPU", "HPC", "MLOps", "Data Pipeline",
  ];

  for (const s of skillMap) {
    if (text.includes(s.toLowerCase())) {
      skills.add(s);
    }
  }

  return [...skills].slice(0, 6);
}

function classifyRole(title) {
  const t = title.toLowerCase();
  if (/research/i.test(t)) return "Research";
  if (/infra|platform|systems/i.test(t)) return "Infra/Platform";
  if (/ml engineer|ai engineer/i.test(t)) return "ML/AI Engineer";
  if (/data scientist/i.test(t)) return "Data Scientist";
  if (/product/i.test(t)) return "Product";
  if (/safety|alignment/i.test(t)) return "Safety/Alignment";
  if (/sales|marketing|business/i.test(t)) return "Sales/Marketing";
  return "Engineering";
}

// ===================== Main =====================

async function run() {
  const date = todayISO();
  const dateDir = path.join(dataDir, date);

  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  const allJobs = [];

  // Search for each company's AI jobs
  console.log("[BigTech Jobs] Searching for AI/ML jobs...");

  for (const company of COMPANIES) {
    const queries = [
      `${company.name} AI Engineer`,
      `${company.name} Machine Learning Engineer`,
      `${company.name} Research Scientist AI`,
    ];

    for (const query of queries) {
      const jobs = await searchCompanyJobs(company.name, query);
      console.log(`  ${company.name} (${query}): ${jobs.length} jobs`);

      for (const job of jobs) {
        allJobs.push({
          title: job.title,
          url: job.url,
          company: job.company,
          skills: extractKeySkills(job.title, ""),
          role_type: classifyRole(job.title),
          source: "web_search",
        });
      }

      await sleep(400);
    }
  }

  // Deduplicate by URL
  const seenUrls = new Set();
  const uniqueJobs = allJobs.filter(job => {
    if (seenUrls.has(job.url)) return false;
    seenUrls.add(job.url);
    return true;
  });

  // Sort by company priority (M7 first)
  const m7Priority = ["OpenAI", "Anthropic", "Google", "Meta", "Microsoft", "Amazon", "Tesla", "Apple", "xAI", "Nvidia"];
  uniqueJobs.sort((a, b) => {
    const aIdx = m7Priority.indexOf(a.company);
    const bIdx = m7Priority.indexOf(b.company);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Build output
  const payload = {
    source: "bigtech_ai_jobs",
    date,
    companies_targeted: COMPANIES.map(c => c.name),
    total_collected: uniqueJobs.length,
    jobs: uniqueJobs,
    summary: {
      by_company: {},
      by_role: {},
      by_source: {},
    },
  };

  // Summary stats
  for (const job of uniqueJobs) {
    const company = job.company;
    const role = job.role_type;
    const source = job.source;

    payload.summary.by_company[company] = (payload.summary.by_company[company] || 0) + 1;
    payload.summary.by_role[role] = (payload.summary.by_role[role] || 0) + 1;
    payload.summary.by_source[source] = (payload.summary.by_source[source] || 0) + 1;
  }

  const outPath = path.join(dateDir, `bigtech_ai_jobs.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[BigTech Jobs] Wrote ${uniqueJobs.length} jobs → ${outPath}`);
  console.log(`  By company: ${JSON.stringify(payload.summary.by_company)}`);
  console.log(`  By role: ${JSON.stringify(payload.summary.by_role)}`);
}

run().catch(err => {
  console.error("[BigTech Jobs] Fatal error:", err);
  process.exit(1);
});
