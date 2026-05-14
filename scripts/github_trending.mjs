// scripts/github_trending.mjs
// Fetch GitHub Trending (daily), enrich with real stars/forks/topics,
// README-based analysis, rising-star detection, and "new_this_day" tracking.
// Node 22+ built-in only. No npm installs.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

const TRENDING_URL = "https://github.com/trending?since=daily";
const MAX_REPOS = 30;
const README_MAX_CHARS = 3000;

// ---------- Date helpers ----------

function todayISO() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- Utilities ----------

function parseNumber(s) {
  if (!s) return null;
  const cleaned = s.replace(/,/g, "").replace(/[^0-9]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------- Fetch Trending HTML ----------

async function fetchHTML() {
  const res = await fetch(TRENDING_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub Trending fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function parseTrending(html) {
  const items = [];
  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>/g;
  const positions = [];
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    positions.push(m.index);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const chunk = html.slice(start, end);

    const repoMatch = chunk.match(
      /<h2[^>]*>.*?<a[^>]*href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"[^>]*>/s
    );
    if (!repoMatch) continue;
    const repo = repoMatch[1].trim();

    if (
      repo.includes("sponsor") ||
      repo.includes("sponsors") ||
      !repo.includes("/")
    )
      continue;

    const descMatch = chunk.match(
      /<p class="col-9[^"]*"[^>]*>(.*?)<\/p>/s
    );
    const description = (descMatch && stripTags(descMatch[1]) || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    const langMatch = chunk.match(
      /itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/i
    );
    const language = (langMatch && langMatch[1].trim()) || null;

    const todayMatch = chunk.match(
      /([\d,]+)\s*stars today/i
    );
    const recent_stars = parseNumber(todayMatch && todayMatch[1] || null);

    items.push({
      repo,
      description,
      language,
      recent_stars,
      url: `https://github.com/${repo}`,
    });

    if (items.length >= MAX_REPOS) break;
  }

  return items;
}

// ---------- GitHub API ----------

async function fetchRepoMeta(owner, repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "AlphaHunter-TrendingBot/1.0",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      stars: data.stargazers_count ?? null,
      forks: data.forks_count ?? null,
      language: data.language || null,
      description: data.description || null,
      topics: Array.isArray(data.topics) ? data.topics.slice(0, 10) : [],
      owner: data.owner || null,
    };
  } catch {
    return null;
  }
}

// ---------- README fetch ----------

async function fetchREADME(owner, repo) {
  const candidates = [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "AlphaHunter-TrendingBot/1.0",
        },
      });
      if (res.ok) {
        const text = await res.text();
        return text.slice(0, README_MAX_CHARS);
      }
    } catch {
      // continue
    }
  }
  return null;
}

// ---------- Owner type ----------

function guessOwnerType(ownerInfo) {
  const o = (ownerInfo && typeof ownerInfo.login === "string") ? ownerInfo.login.toLowerCase() : "";
  const knownOrgPrefixes = [
    "google", "meta", "microsoft", "meta-", "nvidia", "openai", "anthropic",
    "amazon", "aws", "github", "vercel", "vllm-project", "huggingface",
    "deepgram", "deepmind", "meta-llama", "mistralai", "cohere-ai",
  ];
  if (knownOrgPrefixes.some(p => o.startsWith(p) || o.includes(p))) return "org";
  if (ownerInfo && ownerInfo.type && typeof ownerInfo.type === "string") {
    if (ownerInfo.type.toLowerCase() === "organization") return "org";
  }
  return "individual";
}

// ---------- Yesterday tracking ----------

function getYesterdayRepoSet() {
  const yest = yesterdayISO();
  const data = safeReadJSON(path.join(DATA_DIR, `github_trending_${yest}.json`));
  if (!data || !Array.isArray(data.items)) return new Set();
  return new Set(data.items.map(r => r.repo));
}

// ---------- Analysis: extract repo_summary, why_people_care, architecture_tech ----------

function analyzeRepo(repo, description, language, topics, stars, recent_stars, readme) {
  const allText = [repo, description, (topics || []).join(" "), readme].join(" ").toLowerCase();

  // repo_summary: 2-3 line explanation of what it actually does
  const repo_summary = buildRepoSummary(repo, description, readme, allText);

  // why_people_care: 1-2 line, specific, no boilerplate
  const why_people_care = buildWhyPeopleCare(repo, description, recent_stars, allText);

  // architecture_tech: key technologies
  const architecture_tech = extractArchitectureTech(language, topics, allText);

  return { repo_summary, why_people_care, architecture_tech };
}

function buildRepoSummary(repo, description, readme, allText) {
  if (!description && !readme) return "Trending repo; limited info available.";

  // Use description as base if strong
  if (description && description.length > 20) {
    return description.trim().slice(0, 180);
  }

  // Use first meaningful lines from README
  if (readme) {
    const lines = readme
      .split("\n")
      .map(l => l.replace(/[#*`_~]/g, "").trim())
      .filter(l => l.length > 15 && l.length < 200 && !l.startsWith("![") && !l.startsWith("#"));
    if (lines.length >= 1) {
      return lines[0].slice(0, 180);
    }
  }

  return "Trending repo; specifics unclear from available metadata.";
}

function buildWhyPeopleCare(repo, description, recent_stars, allText) {
  const velocity = (recent_stars || 0) > 0 ? `+${recent_stars} stars today` : "on GitHub Trending";

  // AI agents
  if (hasAny(allText, ["agent", "agentic", "multi-agent", "mcp", "tool-use", "tool calling"])) {
    return `Agents are the hot wedge right now — this repo solves a concrete agent problem and is pulling ${velocity}.`;
  }
  // LLM inference / serving
  if (hasAny(allText, ["llm", "vllm", "tensorrt", "llama.cpp", "speculat", "inference", "serving"])) {
    return `Low-latency, cheap inference is the bottleneck — this project attacks that and is gaining ${velocity}.`;
  }
  // RAG / retrieval
  if (hasAny(allText, ["rag", "retrieval augmented", "vector search", "semantic search"])) {
    return `Production RAG needs reliable retrieval, not demos — this repo is filling that gap with ${velocity}.`;
  }
  // Vector DB
  if (hasAny(allText, ["vector"]) && hasAny(allText, ["database", "db", "store", "index"])) {
    return `Semantic search and embeddings are exploding; this vector store is riding that wave with ${velocity}.`;
  }
  // Fine-tuning / training
  if (hasAny(allText, ["fine-tun", "finetune", "sft", "rlhf", "grpo"])) {
    return `Domain-specific fine-tuning is a moat — this tool makes it easier and is attracting ${velocity}.`;
  }
  // On-device / quantization
  if (hasAny(allText, ["quantize", "gguf", "on-device", "edge"])) {
    return `On-device and low-cost inference are critical for agents and mobile — this project enables that with ${velocity}.`;
  }
  // Security
  if (hasAny(allText, ["security", "audit", "vulnerab", "exploit", "hardening"])) {
    return `AI and infra stacks are prime targets — defensive tooling is under-supplied, hence ${velocity}.`;
  }
  // Crypto / Web3
  if (hasAny(allText, ["crypto", "web3", "blockchain", "token", "defi", "zk"])) {
    return `Crypto/Web3 is seeing renewed infra interest — this project is capturing that with ${velocity}.`;
  }
  // Infra / K8s / observability
  if (hasAny(allText, ["infra", "kubernetes", "k8s", "container", "docker", "observab"])) {
    return `AI/ML workloads are pushing infra to the limit — this tool helps and is pulling ${velocity}.`;
  }
  // Devtools / CLIs / IDEs
  if (hasAny(allText, ["ide", "editor", "vscode", "neovim", "devtools", "cli"])) {
    return `AI-native dev tools are reshaping how engineers work — this one is resonating with ${velocity}.`;
  }
  // Data / ETL
  if (hasAny(allText, ["data", "etl", "pipeline", "streaming"])) {
    return `Training, analytics, and agent memory all depend on data pipelines — this is filling that need with ${velocity}.`;
  }
  // Testing / e2e
  if (hasAny(allText, ["testing", "e2e", "playwright", "cypress"])) {
    return `AI/ML and infra systems need more rigorous testing — this framework is answering that with ${velocity}.`;
  }
  // Fallback: still specific, no fluff
  return `Trending with ${velocity}; worth watching, though specifics are unclear from metadata alone.`;
}

function extractArchitectureTech(language, topics, allText) {
  const tech = [];
  if (language) tech.push(language);

  const topicList = (topics || []).map(t => t.toLowerCase());
  const knownTechWords = [
    "rust", "python", "typescript", "javascript", "go", "golang",
    "react", "next.js", "nextjs", "vue", "svelte", "angular",
    "pytorch", "tensorflow", "jax", "transformers",
    "docker", "kubernetes", "k8s",
    "redis", "postgres", "postgresql", "mongo", "mongodb", "sqlite",
    "grpc", "rest", "graphql",
    "webassembly", "wasm",
    "cuda", "tpu", "gpu",
    "llama.cpp", "vllm", "tensorrt",
    "mcp", "model context protocol",
  ];

  for (const t of knownTechWords) {
    if (!tech.includes(t) && hasAny(allText, [t])) {
      tech.push(t);
    }
  }

  for (const tp of topicList) {
    if (!tech.includes(tp) && tp.length > 2 && tp.length < 30 && !tp.includes(" ")) {
      tech.push(tp);
    }
  }

  return tech.slice(0, 10);
}

function hasAny(text, keywords) {
  const t = (text || "").toLowerCase();
  return keywords.some(k => t.includes(k));
}

// ---------- Derive topics (fallback) ----------

function deriveTopics(metaTopics, description) {
  if (metaTopics && metaTopics.length > 0) return metaTopics;
  if (!description) return [];
  const stopWords = new Set([
    "your", "with", "that", "this", "from", "into", "they", "them",
    "like", "just", "more", "most", "also", "very", "such", "each",
    "their", "what", "which", "where", "when", "how", "new", "way",
    "you", "use", "used", "using", "help", "make", "takes",
    "personal", "simple", "super", "powerful", "easy", "fast", "better",
    "modern", "next", "future", "own", "open",
  ]);
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w));
  const counts = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

// ---------- Enrich repos ----------

async function enrichRepos(repos) {
  const yesterdaySet = getYesterdayRepoSet();
  const enriched = [];

  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    const [owner, name] = r.repo.split("/");
    if (!owner || !name) continue;

    const meta = await fetchRepoMeta(owner, name);

    const stars = (meta?.stars ?? null) || (r.stars ?? null);
    const forks = meta?.forks ?? null;
    const language = meta?.language || r.language || null;
    const description = meta?.description || r.description || "";

    const apiTopics = (Array.isArray(meta?.topics) ? meta.topics : []);
    const topics = (apiTopics.length > 0 ? apiTopics.slice(0, 8) : deriveTopics(apiTopics, description).slice(0, 6));

    const owner_type = guessOwnerType(meta?.owner);

    // Rising star: recent_stars > 500 AND total_stars < 10,000 (emerging, not established)
    const is_rising_star = (r.recent_stars || 0) > 500 && (stars || 0) < 10000;

    // new_this_day: not featured yesterday
    const new_this_day = !yesterdaySet.has(r.repo);

    // Fetch README for deeper repos (high recent_stars or rising star)
    let readme = null;
    const shouldFetchReadme = (r.recent_stars || 0) > 200 || is_rising_star;
    if (shouldFetchReadme) {
      try {
        readme = await fetchREADME(owner, name);
      } catch {
        // ignore
      }
    }

    // Analyze
    const { repo_summary, why_people_care, architecture_tech } = analyzeRepo(
      r.repo,
      description,
      language,
      topics,
      stars,
      r.recent_stars,
      readme
    );

    enriched.push({
      repo: r.repo,
      url: r.url,
      description,
      language,
      stars,
      recent_stars: r.recent_stars,
      forks,
      topics,
      owner_type,
      is_rising_star,
      new_this_day,
      repo_summary,
      why_people_care,
      architecture_tech,
    });

    // Small delay to be nice to GitHub API
    if (i % 5 === 4) await sleep(400);
  }

  return enriched;
}

// ---------- Main ----------

async function main() {
  try {
    const html = await fetchHTML();
    const items = parseTrending(html);

    if (!items || items.length === 0) {
      console.error("Error: no repos parsed from GitHub Trending");
      process.exit(1);
    }

    console.log(`Parsed ${items.length} repos from Trending; enriching via GitHub API + README...`);
    const enriched = await enrichRepos(items);

    const date = todayISO();
    const out = {
      source: "github_trending",
      date,
      period: "daily",
      items: enriched,
    };

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const file = path.join(DATA_DIR, `github_trending_${date}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf-8");

    const risingStars = enriched.filter(r => r.is_rising_star).length;
    const newToday = enriched.filter(r => r.new_this_day).length;
    console.log(`OK: wrote ${file} with ${enriched.length} enriched repos (rising_stars=${risingStars}, new_today=${newToday})`);
  } catch (err) {
    console.error("Error in github_trending.mjs:", err.message || err);
    process.exit(1);
  }
}

main();
