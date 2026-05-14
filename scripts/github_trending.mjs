// scripts/github_trending.mjs
// Fetch GitHub Trending (daily), enrich with real stars/forks/topics/why_notable.
// Node 22+ built-in only. No npm installs.

const URL = "https://github.com/trending?since=daily";
const MAX_REPOS = 30;

function today() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseNumber(s) {
  if (!s) return null;
  const cleaned = s.replace(/,/g, "").replace(/[^0-9]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function fetchHTML() {
  const res = await fetch(URL, {
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

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
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

// GitHub API helpers (public, no auth, subject to rate limits)
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
      topics: Array.isArray(data.topics) ? data.topics.slice(0, 8) : null,
      owner: data.owner || null,
    };
  } catch {
    return null;
  }
}

// Generate short, domain-aware "why_notable" from context
function generateWhyNotable(repo, description, language, topics, recent_stars) {
  if (!repo) return "";
  const lower = (repo + " " + (description || "") + " " + (topics || []).join(" ")).toLowerCase();
  const lang = (language || "").toLowerCase();

  const domain = classifyDomain(lower);
  const signal = recent_stars != null && recent_stars > 0
    ? `+${recent_stars} stars today`
    : "rapidly trending";

  if (lower.includes("agent") || lower.includes("agentic") || lower.includes("ai assistant")) {
    return `AI agent runtime/tooling with strong momentum (${signal}); relevant for autonomous workflows and multi-agent infra.`;
  }
  if (lower.includes("llm") || lower.includes("large language model") || lower.includes("llama")) {
    return `Core LLM/LLM-stack project gaining traction (${signal}); important for model serving, fine-tuning, or efficiency.`;
  }
  if (lower.includes("rag") || lower.includes("retrieval augmented")) {
    return `RAG/search stack component trending quickly (${signal}); key for production knowledge retrieval pipelines.`;
  }
  if (lower.includes("vector") && (lower.includes("database") || lower.includes("db"))) {
    return `VectorDB/ANN library with strong interest (${signal}); critical for semantic search and embeddings at scale.`;
  }
  if (lower.includes("fine-tun") || lower.includes("finetune") || lower.includes("sft")) {
    return `Fine-tuning/training tool trending (${signal}); valuable for domain-specific model adaptation.`;
  }
  if (lower.includes("quantize") || lower.includes("quantization") || lower.includes("gguf") || lower.includes("llama.cpp")) {
    return `Model quantization/efficiency tool gaining attention (${signal}); enables on-device or low-cost inference.`;
  }
  if (lower.includes("security") || lower.includes("audit") || lower.includes("vulnerab")) {
    return `Security/auditing tool with rising interest (${signal}); useful for hardening AI, infra, or crypto stacks.`;
  }
  if (lower.includes("crypto") || lower.includes("web3") || lower.includes("blockchain")) {
    return `Crypto/Web3 project trending (${signal}); watch for protocol or infra-level alpha.`;
  }
  if (lower.includes("depin") || lower.includes("depin") || lower.includes("depin") || lower.includes("depin")) {
    return `DePIN/infra-related project trending (${signal}); potential for physical-digital infrastructure plays.`;
  }
  if (lower.includes("infra") || lower.includes("kubernetes") || lower.includes("container")) {
    return `Infra/containers project trending (${signal}); relevant for scalable AI/ML deployments.`;
  }
  if (lower.includes("devtools") || lower.includes("cli") || lower.includes("build tool")) {
    return `Devtools/CLI gaining traction (${signal}); improves dev velocity for AI-native stacks.`;
  }
  if (lower.includes("data") && (lower.includes("pipeline") || lower.includes("etl"))) {
    return `Data pipeline/ETL tool trending (${signal}); important for training and analytics workflows.`;
  }
  if (lower.includes("testing") || lower.includes("test") || lower.includes("e2e")) {
    return `Testing framework trending (${signal}); critical for reliable AI/ML and infra systems.`;
  }
  if (lower.includes("ci") || lower.includes("cd") || lower.includes("pipeline")) {
    return `CI/CD tool trending (${signal}); key for faster, safer delivery of AI and infra changes.`;
  }
  if (lower.includes("monitor") || lower.includes("observab") || lower.includes("telemetry")) {
    return `Observability/monitoring tool trending (${signal}); essential for AI system reliability.`;
  }
  if (lower.includes("dashboard") || lower.includes("analytics") || lower.includes("metrics")) {
    return `Analytics/observability tool trending (${signal}); useful for AI ops and business metrics.`;
  }
  if (lower.includes("ui") || lower.includes("frontend") || lower.includes("design") || lower.includes("figma")) {
    return `UI/frontend tool trending (${signal}); relevant for AI-powered apps and design workflows.`;
  }
  if (lower.includes("editor") || lower.includes("ide") || lower.includes("vscode") || lower.includes("neovim")) {
    return `Editor/IDE tool trending (${signal}); important for developer productivity and AI-assisted coding.`;
  }
  if (lower.includes("python") || lower.includes("javascript") || lower.includes("typescript") || lower.includes("rust")) {
    return `Dev tool in ${lang || "popular runtime"} trending (${signal}); broad impact on developer workflows.`;
  }

  // Generic fallback, still useful
  return `Trending repo with strong momentum (${signal}); ${domain ? "fits " + domain + " landscape." : "worth watching for domain impact."}`;
}

// Lightweight domain classifier
function classifyDomain(text) {
  if (/\b(ai|llm|agent|gpt|transformer|diffusion)\b/.test(text)) return "AI/ML";
  if (/\b(blockchain|web3|smart contract|crypto)\b/.test(text)) return "Crypto/Web3";
  if (/\b(kubernetes|k8s|container|docker)\b/.test(text)) return "Infra";
  if (/\b(security|vulnerability|audit)\b/.test(text)) return "Security";
  if (/\b(tool|cli|devtools|ide)\b/.test(text)) return "DevTools";
  if (/\b(data|etl|pipeline)\b/.test(text)) return "Data";
  return null;
}

// Build topics from meta or from title/description
function deriveTopics(metaTopics, description) {
  if (metaTopics && metaTopics.length > 0) return metaTopics;
  if (!description) return [];
  const stopWords = new Set([
    "your", "with", "that", "this", "from", "into", "they", "them",
    "like", "just", "more", "most", "also", "very", "such", "each",
    "their", "what", "which", "where", "when", "how", "new", "way",
    "you", "use", "used", "using", "help", "make", "takes",
  ]);
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
  const counts = {};
  for (const w of words) {
    counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);
}

// Simple heuristic to guess owner type
function guessOwnerType(ownerInfo, repo) {
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

// Enrich repos with real GitHub data and alpha fields
async function enrichRepos(repos) {
  const enriched = [];

  for (let i = 0; i < repos.length; i++) {
    const r = repos[i];
    const [owner, name] = r.repo.split("/");
    if (!owner || !name) continue;

    const meta = await fetchRepoMeta(owner, name);

    // stars: prefer API; fallback to existing if any
    const stars = (meta?.stars ?? null) || (r.stars ?? null);

    const forks = meta?.forks ?? null;
    const language = meta?.language || r.language || null;
    const description = meta?.description || r.description || "";

    // topics: prefer API topics, capped at 6; fallback to derived
    const apiTopics = (Array.isArray(meta?.topics) ? meta.topics : []);
    const topics = (apiTopics.length > 0 ? apiTopics.slice(0, 6) : deriveTopics(apiTopics, description).slice(0, 6));

    // owner_type
    const owner_type = guessOwnerType(meta?.owner, r.repo);

    const why_notable = generateWhyNotable(
      r.repo,
      description,
      language,
      topics,
      r.recent_stars
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
      why_notable,
    });
  }

  return enriched;
}

async function main() {
  try {
    const html = await fetchHTML();
    const items = parseTrending(html);

    if (!items || items.length === 0) {
      console.error("Error: no repos parsed from GitHub Trending");
      process.exit(1);
    }

    console.log(`Parsed ${items.length} repos from Trending; enriching via GitHub API...`);
    const enriched = await enrichRepos(items);

    const date = today();
    const out = {
      source: "github_trending",
      date,
      period: "daily",
      items: enriched,
    };

    const fs = await import("fs");
    const path = await import("path");
    const dataDir = path.default.resolve("data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const file = path.default.join(dataDir, `github_trending_${date}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf-8");

    console.log(`OK: wrote ${file} with ${enriched.length} enriched repos`);
  } catch (err) {
    console.error("Error in github_trending.mjs:", err.message || err);
    process.exit(1);
  }
}

main();
