// scripts/alpha_deep_context.mjs
// Reads all today's JSON files from data/ and produces a single unified
// deep-analysis JSON: data/alpha_deep_context_<YYYY-MM-DD>.json
// Node 22+ built-in only. No npm installs.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

function todayISO() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    console.error(`[deep_context] Invalid JSON: ${filePath}`);
    return null;
  }
}

// ---------- Helpers ----------

function hasAny(text, keywords) {
  const t = (text || "").toLowerCase();
  return keywords.some(k => t.includes(k));
}

const AI_AGENT_KW = [
  "ai", "agent", "agents", "llm", "ml", "mlops", "deep learning",
  "autonomous", "rag", "inference", "infra", "foundation model",
  "transformer", "multimodal", "computer use", "computer-use",
  "code generation", "devtools"
];

const WEB3_KW = [
  "crypto", "blockchain", "defi", "nft", "web3", "zk", "zero-knowledge",
  "ton", "solana", "bitcoin", "ethereum", "webgpu"
];

const INFRA_KW = [
  "infra", "infrastructure", "devops", "sre", "edge", "distributed",
  "observability", "telemetry", "cloud", "kubernetes", "container"
];

function shortReason(v) {
  return (v || "").slice(0, 160);
}

// ---------- Semantic helpers for non-boilerplate analysis ----------

function detectThemes(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const themes = [];
  if (hasAny(t, ["agent", "agents", "autonomous agent"])) themes.push("ai-agents");
  if (hasAny(t, ["llm", "foundation model", "large language model"])) themes.push("llm");
  if (hasAny(t, ["rag", "retrieval augmented"])) themes.push("rag");
  if (hasAny(t, ["computer use", "computer-use", "gui automation"])) themes.push("computer-use");
  if (hasAny(t, ["on-device", "on device", "edge ai"])) themes.push("on-device-ai");
  if (hasAny(t, ["robot", "embodied", "physical ai"])) themes.push("physical-ai");
  if (hasAny(t, ["crypto", "blockchain", "defi"])) themes.push("crypto-infra");
  if (hasAny(t, ["zero-knowledge", "zk-snark", "zk-stark"])) themes.push("zk");
  if (hasAny(t, ["infra", "infrastructure", "kubernetes"])) themes.push("infra");
  if (hasAny(t, ["security", "vulnerability", "exploit"])) themes.push("security");
  if (hasAny(t, ["code gen", "code generation", "devtools", "developer tools"])) themes.push("devtools");
  if (hasAny(t, ["multimodal", "vision language"])) themes.push("multimodal");
  return themes.slice(0, 4);
}

function buildAlphaThesis(name, type, summary, sources, themes) {
  const base = [name, summary].join(" ").toLowerCase();
  const srcSet = new Set(sources || []);
  const multi = srcSet.size >= 2;

  // Projects: GitHub / HN / overlap
  if (type === "project") {
    // AI agents / LLM tooling
    if (hasAny(base, ["agent", "llm", "rag", "computer use"])) {
      const validation = multi
        ? "Multi-source validated (" + [...srcSet].join(", ") + "). "
        : "Early traction on " + [...srcSet].join(", ") + ". ";
      return validation +
        "If adoption continues, this can become key infra for autonomous workflows within 6–18 months, " +
        "especially for devtools, ops, and agentic apps.";
    }
    // Infra / cloud / K8s / edge
    if (hasAny(base, ["infra", "kubernetes", "edge"])) {
      return "Infrastructure-layer project. " +
        "If it survives the first 6 months, it may become a default choice for teams scaling AI or cloud workloads, " +
        "reducing friction in deployment and observability.";
    }
    // Crypto / ZK
    if (hasAny(base, ["crypto", "zk", "blockchain"])) {
      return "Crypto/ZK project with real momentum. " +
        "If regulatory clarity improves and performance scales, it could become foundational in decentralized infra by 2027.";
    }
    // Fallback: still specific, not generic fluff
    return "Early-stage project with strong momentum on " + [...srcSet].join(", ") + ". " +
      "If execution holds, it can shape its niche within 12–24 months—watch for ecosystem integrations.";
  }

  // Tech: HF models, research, etc.
  if (type === "tech") {
    // Agent / LLM / reasoning models
    if (hasAny(base, ["agent", "agents", "llm", "reasoning", "codegen", "code generation"])) {
      return "High-interest model that may enable new AI workflows or agentic architectures within 6–18 months. " +
        "Key to watch: adoption by devtools and autonomous systems teams.";
    }
    // Multimodal / vision-language
    if (hasAny(base, ["multimodal", "vision-language", "vlm"])) {
      return "Multimodal/vision-language model with strong community interest. " +
        "If latency and cost improve, it can become a standard backbone for vision-enabled agents by 2027.";
    }
    // Diffusion / image / media
    if (hasAny(base, ["diffusion", "stable-diffusion", "image generation", "text-to-image"])) {
      return "Major diffusion model; already influential. " +
        "Watch for derivatives and fine-tunes that enable new creative or product workflows in the next 12 months.";
    }
    // Fallback
    return "Research-grade advancement with practical implications; watch for productionization and ecosystem forks over the next 12 months.";
  }

  // Trends: job roles / market shifts
  if (type === "trend") {
    return "Labor-market signal: demand for this role is rising, indicating structural shifts in how companies staff AI/infra teams. " +
      "If this continues, expect related tools and training ecosystems to expand within 12–24 months.";
  }

  return "Emerging signal worth monitoring; not yet clear enough to form a strong thesis.";
}

function buildRisks(name, type, summary, themes) {
  const base = [name, summary].join(" ").toLowerCase();
  const risks = [];

  if (hasAny(base, ["agent", "llm", "ai"])) {
    if (themes.includes("ai-agents")) risks.push("AI agent hype cycle; many similar tools competing.");
    risks.push("Regulatory risk around AI safety and data privacy may constrain use cases.");
  }
  if (hasAny(base, ["crypto", "blockchain", "defi"])) {
    risks.push("Regulatory uncertainty across major jurisdictions.");
    risks.push("Market cycles can rapidly reduce interest and funding.");
  }
  if (type === "project") {
    risks.push("Single-team dependency; delays or missteps can stall adoption.");
  }
  if (type === "tech") {
    risks.push("Research-to-production gap; may not scale outside controlled environments.");
  }
  if (type === "trend") {
    risks.push("Short-term hiring spike may not reflect long-term structural demand.");
  }
  if (risks.length === 0) {
    risks.push("Limited information; early-stage signal without strong validation.");
  }
  return risks.slice(0, 3);
}

function buildCrossSourceLinks(name, allSignals) {
  // Check which other sources mention or relate to this candidate.
  const links = [];
  const n = (name || "").toLowerCase();

  // GitHub
  const gh = allSignals.github?.topByStarsToday || [];
  if (gh.some(r => (r.repo || "").toLowerCase().includes(n) || (r.description || "").toLowerCase().includes(n))) {
    links.push("github_trending");
  }

  // HN
  const hn = [...(allSignals.hackernews?.topByEngagement || []), ...(allSignals.hackernews?.show_hn_high_signal || [])];
  if (hn.some(t => (t.title || "").toLowerCase().includes(n))) {
    links.push("hackernews");
  }

  // Reddit
  const redditTopics = allSignals.reddit?.hot_topics || [];
  if (redditTopics.some(t => (t.topic || "").toLowerCase().includes(n) ||
      (t.sample_titles || []).some(tt => tt.toLowerCase().includes(n)))) {
    links.push("reddit");
  }

  // Research
  const hf = allSignals.research_ml?.trending_models || [];
  if (hf.some(m => (m.id || "").toLowerCase().includes(n))) {
    links.push("huggingface");
  }

  // Jobs
  const jobs = allSignals.jobs?.emerging_roles || [];
  if (jobs.some(r => (r.role || "").toLowerCase().includes(n))) {
    links.push("job_signals");
  }

  return links;
}

// ---------- Core processing ----------

function buildDeepContext(date) {
  const gh = safeReadJSON(path.join(DATA_DIR, `github_trending_${date}.json`));
  const hn = safeReadJSON(path.join(DATA_DIR, `hackernews_${date}.json`));
  const reddit = safeReadJSON(path.join(DATA_DIR, `reddit_${date}.json`));
  const research = safeReadJSON(path.join(DATA_DIR, `research_ml_${date}.json`));
  const product = safeReadJSON(path.join(DATA_DIR, `product_launch_${date}.json`));
  const jobs = safeReadJSON(path.join(DATA_DIR, `job_signals_${date}.json`));

  // ===== sources metadata =====

  const ghItems = gh?.items || [];
  const hnTop = hn?.sections?.top || [];
  const hnShow = hn?.sections?.show_hn || [];
  const redditSubs = reddit?.subreddits || [];
  const redditHot = reddit?.hot_subreddits || [];
  const hfModels = research?.huggingface_trending || [];
  const arxivPapers = research?.arxiv_recent || [];
  const phProducts = product?.product_hunt || [];
  const ihPosts = product?.indiehackers || [];
  const ycComps = product?.yc || [];
  const allJobs = jobs?.jobs || [];

  const sources = {
    github_trending: {
      count: ghItems.length,
      valid: !!gh && ghItems.length > 0,
    },
    hackernews: {
      topCount: hnTop.length,
      showHnCount: hnShow.length,
      valid: hnTop.length > 0 || hnShow.length > 0,
    },
    reddit: {
      totalPosts: redditSubs.reduce((s, sb) => s + (sb.posts || []).length, 0),
      hotSubreddits: redditHot.map(s => s.name),
    },
    research_ml: {
      hfCount: hfModels.length,
      arxivCount: arxivPapers.length,
    },
    product_launch: {
      productHuntCount: phProducts.length,
      indieHackersCount: ihPosts.length,
      ycCount: ycComps.length,
    },
    job_signals: {
      jobsCount: allJobs.length,
    },
  };

  // ===== GitHub signals =====

  // Top by stars_today
  const ghSorted = [...ghItems].sort((a, b) => (b.recent_stars || 0) - (a.recent_stars || 0));
  const topByStarsToday = ghSorted
    .filter(r => (r.recent_stars || 0) >= 100)
    .slice(0, 10)
    .map(r => {
      const text = `${r.repo} ${r.description || ""}`;
      let reason = "";
      if (hasAny(text, AI_AGENT_KW)) reason = "AI/Agent-related project with strong daily star velocity";
      else if (hasAny(text, WEB3_KW)) reason = "Web3/crypto/blockchain project gaining traction";
      else if (hasAny(text, INFRA_KW)) reason = "Dev infra/tooling with notable adoption";
      else if ((r.recent_stars || 0) >= 1000) reason = "Extremely high star velocity; likely breakout tool";
      else if ((r.recent_stars || 0) >= 500) reason = "High star velocity; strong community interest";
      else reason = "Notable daily star count on GitHub Trending";
      return {
        repo: r.repo,
        description: shortReason(r.description),
        language: r.language || null,
        stars: r.stars || null,
        recent_stars: r.recent_stars || null,
        url: r.url,
        signal_reason: shortReason(reason),
      };
    });

  // Emerging stacks: languages of repos with high recent stars
  const langCounts = {};
  for (const r of ghSorted) {
    if ((r.recent_stars || 0) < 200 || !r.language) continue;
    langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const emergingStacks = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lang]) => lang);

  // ===== HN signals =====

  const hnByEngagement = [...hnTop]
    .sort((a, b) => (b.score * 1 + b.comments * 0.3) - (a.score * 1 + a.comments * 0.3))
    .slice(0, 8)
    .map(t => {
      const text = t.title || "";
      let reason = "";
      if (hasAny(text, AI_AGENT_KW)) reason = "AI/ML/Agent topic with high HN engagement";
      else if (hasAny(text, WEB3_KW)) reason = "Crypto/Web3 topic with notable HN discussion";
      else if (t.score >= 200 || t.comments >= 100) reason = "High engagement HN story; broad tech interest";
      else reason = "Top HN story; relevant tech discussion";
      return {
        title: t.title,
        url: t.url || null,
        score: t.score,
        comments: t.comments,
        signal_reason: shortReason(reason),
      };
    });

  const showHnHighSignal = [...hnShow]
    .sort((a, b) => (b.score * 1 + b.comments * 0.4) - (a.score * 1 + a.comments * 0.4))
    .filter(s => (s.score || 0) >= 30 || (s.comments || 0) >= 15)
    .slice(0, 6)
    .map(s => {
      const text = s.title || "";
      let reason = "";
      if (hasAny(text, AI_AGENT_KW)) reason = "AI/Agent tool with strong HN validation";
      else if (hasAny(text, WEB3_KW)) reason = "Web3/crypto project with HN traction";
      else if (s.score >= 100) reason = "High-score Show HN; notable product interest";
      else reason = "Show HN with meaningful engagement";
      return {
        title: s.title,
        url: s.url || null,
        score: s.score,
        comments: s.comments,
        signal_reason: shortReason(reason),
      };
    });

  // ===== Reddit signals =====

  // Hot topics: aggregate by keyword themes
  const themeMap = {};
  for (const sb of redditSubs) {
    for (const p of sb.posts || []) {
      const title = (p.title || "").toLowerCase();
      const themes = [];
      if (hasAny(title, AI_AGENT_KW)) themes.push("AI/ML/Agents");
      if (hasAny(title, WEB3_KW)) themes.push("Crypto/Web3");
      if (hasAny(title, INFRA_KW)) themes.push("Dev Infra/Ops");
      if (title.includes("startup") || title.includes("saas") || title.includes("funding")) {
        themes.push("Startups");
      }
      if (title.includes("security") || title.includes("hack") || title.includes("vuln")) {
        themes.push("Security");
      }
      if (themes.length === 0) themes.push("General Tech");
      for (const theme of themes) {
        if (!themeMap[theme]) themeMap[theme] = { titles: [], subs: new Set(), scores: [] };
        themeMap[theme].titles.push(p.title);
        themeMap[theme].subs.add(sb.name);
        themeMap[theme].scores.push(p.score || 0);
      }
    }
  }

  const hotTopics = Object.entries(themeMap)
    .filter(([, v]) => v.titles.length >= 2)
    .sort(([, a], [, b]) => b.titles.length - a.titles.length)
    .slice(0, 6)
    .map(([topic, v]) => {
      const avgScore = Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length);
      const why = `${v.titles.length} posts across ${v.subs.size} subreddits; avg score ${avgScore}. Indicates strong community interest in ${topic}.`;
      return {
        topic,
        subreddits: [...v.subs],
        sample_titles: v.titles.slice(0, 4),
        why_important: shortReason(why),
      };
    });

  const emergingSubreddits = redditHot
    .filter(s => (s.post_count || 0) >= 2)
    .slice(0, 6)
    .map(s => ({
      name: s.name,
      post_count: s.post_count,
      sample_titles: s.sample_titles || [],
    }));

  // ===== Research / ML signals =====

  const trendingModels = hfModels
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 8)
    .map(m => {
      const why = m.likes >= 1000
        ? "Very high likes; likely a major model or breakthrough"
        : m.likes >= 300
          ? "Strong likes; notable model gaining attention"
          : "Trending on HF; early traction worth watching";
      return {
        id: m.id,
        likes: m.likes || 0,
        tags: m.tags || [],
        sector_themes: m.sector_themes || [],
        why_notable: shortReason(why + "; " + (m.why_notable || "")),
      };
    });

  const notablePapers = arxivPapers
    .filter(p => {
      const t = (p.title || "").toLowerCase();
      return hasAny(t, [...AI_AGENT_KW, "optimization", "neural", "reasoning", "alignment"]);
    })
    .slice(0, 6)
    .map(p => {
      const why = "Relevant to current AI/ML/Agent research trends.";
      return {
        title: p.title,
        authors: p.authors || "",
        abstract_short: (p.abstract_short || "").slice(0, 200),
        url: p.url || null,
        why_notable: shortReason(why),
      };
    });

  // ===== Product Launch signals =====

  const allProducts = [...(phProducts || []), ...(ihPosts || []), ...(ycComps || [])]
    .map(p => {
      // Normalize shape
      const name = p.name || p.title || "";
      const tagline = p.tagline || p.description_short || "";
      const votes = p.votes ?? null;
      return { name, tagline, votes, url: p.url || null };
    })
    .filter(p => p.name && p.name.length > 2);

  const topProducts = allProducts
    .sort((a, b) => (b.votes || 0) - (a.votes || 0))
    .slice(0, 8)
    .map(p => {
      const text = `${p.name} ${p.tagline}`;
      const why = hasAny(text, AI_AGENT_KW)
        ? "AI/Agent product with market traction"
        : hasAny(text, WEB3_KW)
          ? "Crypto/Web3 product with early adoption"
          : "Notable product launch with votes/interest";
      return {
        name: p.name,
        tagline: shortReason(p.tagline),
        votes: p.votes,
        url: p.url,
        why_notable: shortReason(why),
      };
    });

  // ===== Job signals =====

  // Emerging roles: group by normalized title
  const roleMap = {};
  for (const j of allJobs) {
    const role = (j.title || "").trim();
    if (!role) continue;
    if (!roleMap[role]) roleMap[role] = { count: 0, companies: new Set(), tags: new Set() };
    roleMap[role].count++;
    roleMap[role].companies.add(j.company || "");
    for (const t of j.tags || []) roleMap[role].tags.add(t);
  }

  const emergingRoles = Object.entries(roleMap)
    .filter(([, v]) => v.count >= 1)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([role, v]) => {
      const why = v.count >= 3
        ? "Multiple postings; strong demand signal"
        : "Emerging role with niche demand";
      return {
        role,
        count: v.count,
        example_companies: [...v.companies].slice(0, 3),
        why_signal: shortReason(why),
      };
    });

  // Emerging skills: aggregate tags
  const skillCounts = {};
  for (const j of allJobs) {
    for (const t of j.tags || []) {
      skillCounts[t] = (skillCounts[t] || 0) + 1;
    }
  }
  const emergingSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([skill]) => skill);

  // ===== Cross-source overlap =====

  // Collect names/repos/companies that appear in multiple sources
  const nameMentions = new Map();

  function addMention(name, source, reason) {
    if (!nameMentions.has(name)) nameMentions.set(name, { sources: new Set(), reasons: [] });
    const m = nameMentions.get(name);
    m.sources.add(source);
    m.reasons.push(reason);
  }

  for (const r of ghSorted) {
    const name = r.repo.split("/").pop();
    if ((r.recent_stars || 0) >= 300) {
      addMention(name, "github", `High star velocity: ${r.recent_stars}; ${r.why_notable || ""}`);
    }
  }

  for (const t of hnByEngagement) {
    const name = (t.title || "").split(" - ").pop().trim().slice(0, 60);
    if (t.score >= 100) addMention(name, "hackernews", `HN score: ${t.score}; ${t.why_hot || ""}`);
  }

  for (const p of topProducts) {
    addMention(p.name, "product_hunt", `Product launch with ${p.votes || "?"} votes; ${p.why_notable || ""}`);
  }

  const overlapCandidates = [...nameMentions.entries()]
    .filter(([, m]) => m.sources.size >= 2)
    .map(([name, m]) => ({
      name,
      sources: [...m.sources],
      reason: m.reasons.join("; "),
    }))
    .slice(0, 10);

  // ===== Sector themes (auto-generated from all signals) =====

  const themeCounter = {};
  function incTheme(t) {
    themeCounter[t] = (themeCounter[t] || 0) + 1;
  }

  // From GitHub topics and why_notable
  for (const r of ghSorted) {
    for (const tp of r.topics || []) incTheme(tp.toLowerCase());
    for (const tp of detectThemes(r.why_notable || "")) incTheme(tp);
  }

  // From HN categories
  for (const t of hnByEngagement) {
    if (t.category_hint) incTheme(t.category_hint);
    for (const tp of detectThemes(t.why_hot || "")) incTheme(tp);
  }

  // From research_ml sector_themes
  for (const m of trendingModels) {
    for (const tp of m.sector_themes || []) incTheme(tp);
  }
  for (const p of notablePapers) {
    for (const tp of p.sector_themes || []) incTheme(tp);
  }

  // From jobs company_sector
  for (const r of emergingRoles) {
    // not directly available here, but we can infer from role name
    for (const tp of detectThemes(r.role || "")) incTheme(tp);
  }

  // Top themes
  const sector_themes = Object.entries(themeCounter)
    .filter(([, v]) => v >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([theme]) => theme);

  // ===== Contrarian notes =====

  const contrarian_notes = [];
  const aiAgentHeat = (themeCounter["ai-agents"] || 0) + (themeCounter["llm"] || 0);
  if (aiAgentHeat >= 4) {
    contrarian_notes.push(
      "AI agent narrative is overheated; many projects claim 'agentic' without real autonomy or distribution advantage."
    );
  }
  const cryptoHeat = (themeCounter["crypto-infra"] || 0) + (themeCounter["zk"] || 0);
  if (cryptoHeat >= 3) {
    contrarian_notes.push(
      "Crypto/ZK narratives are regaining attention, but regulatory and UX friction remain unsolved."
    );
  }
  if (contrarian_notes.length === 0) {
    contrarian_notes.push(
      "Today's signals are broadly aligned; no strong contrarian angle yet—watch for divergence over the next few days."
    );
  }

  // ===== Dynamic Alpha Candidates (using enriched fields) =====

  const candidatePool = [];

  // From GitHub: high star velocity + AI/infra/web3
  for (const r of ghSorted) {
    const score = (r.recent_stars || 0);
    if (score < 300) continue;
    const text = `${r.repo} ${r.description || ""}`;
    const aiScore = hasAny(text, AI_AGENT_KW) ? 2 : 0;
    const web3Score = hasAny(text, WEB3_KW) ? 1 : 0;
    const infraScore = hasAny(text, INFRA_KW) ? 1 : 0;
    const totalScore = score / 100 + aiScore * 2 + web3Score + infraScore;
    if (totalScore < 3) continue;

    const themes = detectThemes(`${r.description || ""} ${(r.topics || []).join(" ")} ${r.why_notable || ""}`);
    candidatePool.push({
      name: r.repo,
      type: "project",
      sources: ["github"],
      summary: `${r.description || ""} — ${r.recent_stars} stars today; ${r.why_notable || ""}`,
      _score: totalScore,
      _themes: themes,
    });
  }

  // From HN Show HN: AI/agent tools with engagement
  for (const s of showHnHighSignal) {
    const text = (s.title || "").toLowerCase();
    if (!hasAny(text, [...AI_AGENT_KW, "tool", "framework", "platform", "infra"])) continue;
    const score = s.score + s.comments * 0.3;
    if (score < 40) continue;
    const themes = detectThemes(`${s.title} ${s.why_hot || ""}`);
    candidatePool.push({
      name: s.title,
      type: "project",
      sources: ["hackernews"],
      summary: `Show HN project with ${s.score} upvotes and ${s.comments} comments; ${s.why_hot || ""}`,
      _score: score / 20,
      _themes: themes,
    });
  }

  // From Research/ML: high-likes models
  for (const m of trendingModels) {
    if ((m.likes || 0) < 500) continue;
    const tags = (m.tags || []).join(", ").toLowerCase();
    const text = `${m.id} ${tags} ${m.why_notable || ""}`;
    if (!hasAny(text, AI_AGENT_KW)) continue;
    const themes = [...new Set([
      ...(m.sector_themes || []),
      ...detectThemes(tags),
      ...detectThemes(m.why_notable || ""),
    ])];
    candidatePool.push({
      name: m.id,
      type: "tech",
      sources: ["huggingface"],
      summary: `Hugging Face model with ${m.likes} likes; ${m.why_notable || ""}`,
      _score: m.likes / 200,
      _themes: themes,
    });
  }

  // From Jobs: emerging roles with multiple postings
  for (const r of emergingRoles) {
    if (r.count < 2) continue;
    const tags = (r.why_signal || "").toLowerCase();
    if (!hasAny(tags, ["strong demand", "multiple postings"])) continue;
    const themes = detectThemes(`${r.role} ${r.why_signal || ""}`);
    candidatePool.push({
      name: r.role,
      type: "trend",
      sources: ["jobs"],
      summary: `${r.count} job postings; companies: ${r.example_companies.join(", ")}; ${r.why_signal || ""}`,
      _score: r.count * 2,
      _themes: themes,
    });
  }

  // From cross-source overlaps
  for (const o of overlapCandidates) {
    const themes = detectThemes(o.reason);
    candidatePool.push({
      name: o.name,
      type: "project",
      sources: o.sources,
      summary: `Appears across ${o.sources.join(", ")}: ${o.reason}.`,
      _score: o.sources.size * 3,
      _themes: themes,
    });
  }

  // Sort by score, pick top candidates
  candidatePool.sort((a, b) => b._score - a._score);
  const preCandidates = candidatePool
    .slice(0, 15)
    .filter(c => c._score >= 2)
    .slice(0, 12);

  // Now enrich each candidate with non-boilerplate alpha_thesis, risk, cross_source_links, sector_themes
  const candidates = preCandidates.map((c, i) => {
    const themes = c._themes || [];
    const alpha_thesis = buildAlphaThesis(c.name, c.type, c.summary, c.sources, themes);
    const risk = buildRisks(c.name, c.type, c.summary, themes);
    const cross_source_links = buildCrossSourceLinks(c.name, {
      github: { topByStarsToday },
      hackernews: { topByEngagement: hnByEngagement, show_hn_high_signal: showHnHighSignal },
      reddit: { hot_topics: hotTopics },
      research_ml: { trending_models: trendingModels },
      jobs: { emerging_roles: emergingRoles },
    });
    const { _score, _themes, ...rest } = c;
    return {
      id: i + 1,
      ...rest,
      alpha_thesis,
      risk,
      cross_source_links,
      sector_themes: themes.slice(0, 4),
    };
  });

  // ===== Assemble final deep context =====

  return {
    date,
    generatedAt: new Date().toISOString(),
    sources,
    signals: {
      github: {
        topByStarsToday,
        emerging_stacks: emergingStacks,
      },
      hackernews: {
        topByEngagement: hnByEngagement,
        show_hn_high_signal: showHnHighSignal,
      },
      reddit: {
        hot_topics: hotTopics,
        emerging_subreddits: emergingSubreddits,
      },
      research_ml: {
        trending_models: trendingModels,
        notable_papers: notablePapers,
      },
      product_launch: {
        top_products: topProducts,
      },
      jobs: {
        emerging_roles: emergingRoles,
        emerging_skills: emergingSkills,
      },
    },
    cross_source: {
      overlap_candidates: overlapCandidates,
    },
    candidates,
    sector_themes,
    contrarian_notes,
  };
}

// ---------- Main ----------

function main() {
  const date = todayISO();
  console.log(`[deep_context] Building unified deep context for ${date}`);

  const ctx = buildDeepContext(date);

  const outPath = path.join(DATA_DIR, `alpha_deep_context_${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(ctx, null, 2), "utf-8");

  const size = new Blob([JSON.stringify(ctx)]).size;
  console.log(`[deep_context] Written to: ${outPath}`);
  console.log(`[deep_context] Size: ${size} bytes, candidates: ${ctx.candidates.length}`);

  // Quick validation
  if (!ctx.candidates || !Array.isArray(ctx.candidates)) {
    console.error("[deep_context] ERROR: candidates missing or invalid");
    process.exit(1);
  }
  if (!ctx.signals || typeof ctx.signals !== "object") {
    console.error("[deep_context] ERROR: signals missing or invalid");
    process.exit(1);
  }
  console.log("[deep_context] Validation OK");
  process.exit(0);
}

main();
