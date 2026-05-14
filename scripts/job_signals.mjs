#!/usr/bin/env node
// job_signals.mjs
// Collects job signals from YC Work at a Startup (primary) and Wellfound (fallback).
// Enriches each job with:
//   - jd_summary
//   - extracted_skills
//   - why_signal
//   - company_sector
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
  "RLHF",
  "RLAIF",
  "fine-tun",
  "vector search",
  "embedding",
  "rag",
  "tool-use",
  "mcp",
  "backend",
  "full stack",
  "DevOps",
  "SRE",
  "infra engineer",
  "platform engineer",
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

// ---------- Sector classification ----------

const SECTOR_KEYWORDS = {
  "ai-infra": [
    "ai infra",
    "ai infrastructure",
    "ml platform",
    "llm",
    "model serving",
    "mlops",
    "inference",
    "vector search",
    "agent infra",
    "agent infrastructure",
    "training infra",
    "accelerator",
    "gpu cluster",
    "triton",
    "vllm",
    "text generation",
    "rag",
    "embeddings",
  ],
  crypto: [
    "crypto",
    "blockchain",
    "web3",
    "zk",
    "zero-knowledge",
    "ethereum",
    "solana",
    "protocol",
    "depin",
    "token",
    "defi",
    "onchain",
    "rollup",
  ],
  fintech: [
    "fintech",
    "payments",
    "banking",
    "lending",
    "insurance",
    "risk",
    "trading",
    "wealth",
    "financial",
  ],
  healthtech: [
    "health",
    "healthcare",
    "medtech",
    "medical",
    "clinical",
    "biotech",
    "genomics",
  ],
  infra: [
    "cloud",
    "kubernetes",
    "serverless",
    "cdn",
    "edge",
    "networking",
    "storage",
    "observability",
    "sre",
    "devops",
    "distributed systems",
    "runtime",
  ],
  consumer: [
    "social",
    "gaming",
    "content",
    "creator",
    "mobile app",
    "ecommerce",
    "shopping",
    "marketplace",
    "messenger",
  ],
};

function classifySector(context) {
  const lower = (context || "").toLowerCase();
  for (const [sector, kws] of Object.entries(SECTOR_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) {
      return sector;
    }
  }
  return "other";
}

// ---------- Skill extraction ----------

function extractKeySkills(context) {
  const lower = (context || "").toLowerCase();
  const candidates = new Set();

  const skillMap = [
    "Python",
    "TypeScript",
    "Go",
    "Rust",
    "C++",
    "Java",
    "Kubernetes",
    "Docker",
    "Terraform",
    "AWS",
    "GCP",
    "Azure",
    "LLM",
    "Transformer",
    "RAG",
    "Vector DB",
    "PyTorch",
    "TensorFlow",
    "JAX",
    "CUDA",
    "WebGPU",
    "ZK",
    "Zero-Knowledge",
    "Solidity",
    "Web3",
    "Blockchain",
    "React",
    "Next.js",
    "Node.js",
    "PostgreSQL",
    "Redis",
    "Kafka",
    "gRPC",
    "REST",
    "Microservices",
    "CI/CD",
    "SRE",
    "DevOps",
    "Edge AI",
    "AI Agents",
    "Distributed Systems",
  ];

  for (const s of skillMap) {
    if (lower.includes(s.toLowerCase())) {
      candidates.add(s);
    }
  }

  return [...candidates].slice(0, 6);
}

// ---------- JD summary ----------

function buildJdSummary(title, company, location, tags, oneLiner) {
  const core = title || "role";
  const loc = location ? ` based in ${location}` : "";

  if (oneLiner) {
    const combined = `${core} at ${company}: ${oneLiner}`;
    if (combined.length <= 160) return combined;
    return combined.slice(0, 160).trim();
  }

  const focus = tags.length
    ? `focused on ${tags.slice(0, 4).join(", ")}`
    : "";

  if (focus) {
    return `A ${core} role at ${company}${loc}, ${focus}.`;
  }
  return `A ${core} role at ${company}${loc}.`;
}

// ---------- Normalize role into a specific AI-role label ----------

function inferSpecificRole(title, context) {
  const t = (title || "").toLowerCase();
  const c = (context || "").toLowerCase();

  if ((t.includes("llm") || c.includes("llm")) && (t.includes("engineer") || t.includes("developer"))) {
    return "LLM Engineer";
  }
  if ((t.includes("agent") || t.includes("agentic")) && (t.includes("engineer") || t.includes("developer"))) {
    return "AI Agent Engineer";
  }
  if ((t.includes("rlhf") || t.includes("rlaif")) && (t.includes("engineer") || t.includes("researcher"))) {
    return "RLHF/RLAIF Engineer";
  }
  if ((t.includes("mlops") || t.includes("ml ops")) && (t.includes("engineer") || t.includes("developer"))) {
    return "MLOps Engineer";
  }
  if ((t.includes("infra") || t.includes("platform")) && (t.includes("ai") || c.includes("ai"))) {
    return "AI Infra Engineer";
  }
  if ((t.includes("edge") || t.includes("on-device")) && (t.includes("ai") || t.includes("ml"))) {
    return "Edge AI Engineer";
  }
  if ((t.includes("zk") || t.includes("zero-knowledge")) && (t.includes("engineer") || t.includes("developer"))) {
    return "ZK Engineer";
  }
  if ((t.includes("crypto") || t.includes("web3")) && (t.includes("engineer") || t.includes("developer"))) {
    return "Crypto/Web3 Engineer";
  }
  if ((t.includes("ml") || t.includes("machine learning")) && (t.includes("engineer") || t.includes("researcher"))) {
    return "ML Engineer";
  }
  if ((t.includes("data") || t.includes("analytics")) && (t.includes("engineer") || t.includes("scientist"))) {
    return "Data/ML Engineer";
  }
  return null; // leave as-is if generic
}

// ---------- Why signal ----------

function buildWhySignal(title, sector, specificRole) {
  const t = (title || "").toLowerCase();

  if (specificRole === "LLM Engineer") {
    return "Core LLM talent demand signals strong AI application growth and specialization beyond generic ML.";
  }
  if (specificRole === "AI Agent Engineer") {
    return "Rising demand for AI agent infrastructure, tool-use, and orchestration skills.";
  }
  if (specificRole === "RLHF/RLAIF Engineer") {
    return "RLHF/RLAIF hiring reflects maturation of alignment, safety, and preference tuning in production.";
  }
  if (specificRole === "MLOps Engineer") {
    return "MLOps demand reflects scaling AI from prototypes to production with robust pipelines.";
  }
  if (specificRole === "AI Infra Engineer") {
    return "AI infra company hiring: capacity, tooling, and observability demand is expanding.";
  }
  if (specificRole === "Edge AI Engineer") {
    return "Edge AI adoption accelerating; niche but high-impact skill set for on-device inference.";
  }
  if (specificRole === "ZK Engineer") {
    return "ZK engineer shortage: early-stage crypto infra talent war around zero-knowledge proofs.";
  }
  if (specificRole === "Crypto/Web3 Engineer") {
    return "Crypto/Web3 hiring indicates protocol-level innovation and funding.";
  }
  if (t.includes("distributed systems")) {
    return "Distributed systems roles signal infra-heavy AI/crypto workloads.";
  }
  if (sector === "ai-infra") {
    return "AI infra company hiring: capacity and tooling demand is expanding.";
  }
  if (sector === "crypto") {
    return "Crypto/Web3 hiring indicates protocol-level innovation and funding.";
  }
  if (sector === "infra") {
    return "Core infra roles suggest scaling needs in cloud and SRE.";
  }
  return "Relevant tech stack and domain alignment with alpha opportunities.";
}

// ---------- Unified enrichment ----------

function enrichJob(job) {
  const context = [
    job.title,
    job.company,
    job.location,
    (job.tags || []).join(" "),
    job.oneLiner,
  ]
    .filter(Boolean)
    .join(" ");

  const sector = classifySector(context);
  const skills = extractKeySkills(context);
  const specificRole = inferSpecificRole(job.title, context);
  const summary = buildJdSummary(
    job.title,
    job.company,
    job.location,
    job.tags || [],
    job.oneLiner
  );
  const whySignal = buildWhySignal(job.title, sector, specificRole);

  // role_specifics: short, concrete description of what they actually do
  const roleSpecifics = specificRole
    ? `${specificRole} role at ${job.company || "startup"}; ${whySignal}`
    : `General engineering role at ${job.company || "startup"}; ${whySignal}`;

  return {
    ...job,
    specific_role: specificRole || job.title,
    jd_summary: summary,
    extracted_skills: skills,
    role_specifics: roleSpecifics,
    required_stack: skills,
    why_signal: whySignal,
    company_sector: sector,
  };
}

// ---------- YC Work at a Startup ----------

async function fetchYCWorkAtStartup() {
  const html = await fetchText(
    "https://www.workatastartup.com/",
    "YC Work at a Startup"
  );
  if (!html) return [];

  const marker = '&quot;jobs&quot;:[';
  const jobsStart = html.indexOf(marker);
  if (jobsStart === -1) {
    console.log("[YC] No jobs array found in HTML");
    return [];
  }

  const bracketStart = jobsStart + marker.lastIndexOf('[');

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

    const context = `${title} ${company} ${oneLiner} ${roleType}`;
    const tags = extractTags(context);

    if (!title || !company) continue;

    const baseJob = {
      title,
      company,
      tags,
      location,
      salary,
      roleType,
      companyBatch,
      oneLiner: oneLiner || null,
      url: `https://www.workatastartup.com/job/${j.id}`,
    };

    jobs.push(enrichJob(baseJob));
  }

  return jobs;
}

// ---------- Wellfound (fallback) ----------

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

      const baseJob = {
        title,
        company,
        tags,
        location,
        url: `https://wellfound.com/jobs/${j.slug}`,
      };

      jobs.push(enrichJob(baseJob));

      await sleep(60);
    }

    await sleep(300);
  }

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
  const dateDir = path.join(dataDir, date);

  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
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

  const outPath = path.join(dateDir, `job_signals.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[Jobs] Wrote ${allJobs.length} jobs → ${outPath}`);
}

run().catch((err) => {
  console.error("[Jobs] Fatal error:", err);
  process.exit(1);
});
