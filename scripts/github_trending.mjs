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

// Generate a concise, domain-aware "why_notable" for each repo.
function generateWhyNotable(repo, description, language, topics, recent_stars) {
  if (!repo) return "";
  const lower = (repo + " " + (description || "") + " " + (topics || []).join(" ")).toLowerCase();
  const signal = recent_stars != null && recent_stars > 0
    ? `+${recent_stars} stars today`
    : "rapidly trending";

  // AI agents / agent infra
  if (/\b(agent|agentic|multi-agent|tool-use|tool calling)\b/.test(lower)) {
    return `AI agent runtime/tooling with strong momentum (${signal}); relevant for autonomous workflows and multi-agent infra.`;
  }
  // LLMs, model stacks
  if (/\b(llm|large language model|llama|gpt|transformer|diffusion)\b/.test(lower)) {
    return `Core LLM/LLM-stack project gaining traction (${signal}); important for model serving, fine-tuning, or efficiency.`;
  }
  // RAG / retrieval
  if (/\b(rag|retrieval augmented|vector search|semantic search)\b/.test(lower)) {
    return `RAG/search stack component trending quickly (${signal}); key for production knowledge retrieval pipelines.`;
  }
  // Vector DBs
  if (/\b(vector|ann)\b/.test(lower) && /\b(database|db|store|index)\b/.test(lower)) {
    return `VectorDB/ANN library with strong interest (${signal}); critical for semantic search and embeddings at scale.`;
  }
  // Fine-tuning / training
  if (/\b(fine-tun|finetune|sft|training)\b/.test(lower)) {
    return `Fine-tuning/training tool trending (${signal}); valuable for domain-specific model adaptation.`;
  }
  // Quantization / inference efficiency
  if (/\b(quantize|quantization|gguf|llama\.cpp|vllm|tensorrt)\b/.test(lower)) {
    return `Model quantization/efficiency tool gaining attention (${signal}); enables on-device or low-cost inference.`;
  }
  // Security / audit
  if (/\b(security|audit|vulnerab|exploit|hardening)\b/.test(lower)) {
    return `Security/auditing tool with rising interest (${signal}); useful for hardening AI, infra, or crypto stacks.`;
  }
  // Crypto / Web3 / DePIN
  if (/\b(crypto|web3|blockchain|token|defi|nft|depin)\b/.test(lower)) {
    return `Crypto/Web3/DePIN project trending (${signal}); watch for protocol or infra-level alpha.`;
  }
  // Infra / containers / Kubernetes
  if (/\b(infra|kubernetes|k8s|container|docker|telegraf|observab)\b/.test(lower)) {
    return `Infra/containers/observability project trending (${signal}); relevant for scalable AI/ML deployments.`;
  }
  // Devtools / CLIs / IDEs / editors
  if (/\b(ide|editor|vscode|neovim|devtools|cli|build tool)\b/.test(lower)) {
    return `Devtools/IDE gaining traction (${signal}); improves dev velocity for AI-native stacks.`;
  }
  // Data / ETL / pipelines
  if (/\b(data|etl|pipeline|streaming)\b/.test(lower)) {
    return `Data pipeline/ETL tool trending (${signal}); important for training and analytics workflows.`;
  }
  // Testing / e2e
  if (/\b(testing|e2e|playwright|cypress)\b/.test(lower)) {
    return `Testing framework trending (${signal}); critical for reliable AI/ML and infra systems.`;
  }
  // CI/CD
  if (/\b(ci\/cd|continuous)\b/.test(lower)) {
    return `CI/CD tool trending (${signal}); key for faster, safer delivery of AI and infra changes.`;
  }
  // UI / frontend / design
  if (/\b(ui|frontend|design|figma|design system)\b/.test(lower)) {
    return `UI/frontend tool trending (${signal}); relevant for AI-powered apps and design workflows.`;
  }
  // Fallback: short and non-generic
  return `Trending repo with strong momentum (${signal}); worth watching for domain impact.`;
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

// Build topics from meta or from title/description (safer fallback)
function deriveTopics(metaTopics, description) {
  if (metaTopics && metaTopics.length > 0) return metaTopics;
  if (!description) return [];
  const stopWords = new Set([
    "your", "with", "that", "this", "from", "into", "they", "them",
    "like", "just", "more", "most", "also", "very", "such", "each",
    "their", "what", "which", "where", "when", "how", "new", "way",
    "you", "use", "used", "using", "help", "make", "takes",
    "personal", "simple", "super", "powerful", "easy", "fast", "better",
    "modern", "next", "future", "own", "own", "open", "open",
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
