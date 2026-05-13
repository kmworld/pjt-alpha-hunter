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
  "code generation", "code generation", "devtools"
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
  // Clamp length
  return (v || "").slice(0, 160);
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
        why_notable: shortReason(why),
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
  const nameMentions = new Map(); // name -> { sources: Set, reason: [] }

  function addMention(name, source, reason) {
    if (!nameMentions.has(name)) nameMentions.set(name, { sources: new Set(), reasons: [] });
    const m = nameMentions.get(name);
    m.sources.add(source);
    m.reasons.push(reason);
  }

  // GitHub -> names
  for (const r of ghSorted) {
    const name = r.repo.split("/").pop();
    if ((r.recent_stars || 0) >= 300) {
      addMention(name, "github", `High star velocity: ${r.recent_stars}`);
    }
  }

  // HN -> titles
  for (const t of hnByEngagement) {
    const name = (t.title || "").split(" - ").pop().trim().slice(0, 60);
    if (t.score >= 100) addMention(name, "hackernews", `HN score: ${t.score}`);
  }

  // Product Hunt
  for (const p of topProducts) {
    addMention(p.name, "product_hunt", `Product launch with ${p.votes || "?"} votes`);
  }

  // Overlap candidates: names in >=2 sources
  const overlapCandidates = [...nameMentions.entries()]
    .filter(([, m]) => m.sources.size >= 2)
    .map(([name, m]) => ({
      name,
      sources: [...m.sources],
      reason: m.reasons.join("; "),
    }))
    .slice(0, 10);

  // ===== Dynamic Alpha Candidates =====

  // Build a unified pool of candidates from all sources, score them, pick best.
  const candidatePool = [];

  // From GitHub: high star velocity + AI/infra/web3
  for (const r of ghSorted) {
    const text = `${r.repo} ${r.description || ""}`.toLowerCase();
    const score = (r.recent_stars || 0);
    if (score < 300) continue;
    const aiScore = hasAny(text, AI_AGENT_KW) ? 2 : 0;
    const web3Score = hasAny(text, WEB3_KW) ? 1 : 0;
    const infraScore = hasAny(text, INFRA_KW) ? 1 : 0;
    const totalScore = score / 100 + aiScore * 2 + web3Score + infraScore;
    if (totalScore < 3) continue;
    candidatePool.push({
      name: r.repo,
      type: "project",
      sources: ["github"],
      summary: `${r.description || ""} — ${r.recent_stars} stars today.`,
      alpha_thesis: "Strong GitHub momentum; early-stage project with real traction.",
      risk: "May be short-lived hype; verify sustained growth.",
      _score: totalScore,
    });
  }

  // From HN Show HN: AI/agent tools with engagement
  for (const s of showHnHighSignal) {
    const text = (s.title || "").toLowerCase();
    if (!hasAny(text, [...AI_AGENT_KW, "tool", "framework", "platform", "infra"])) continue;
    const score = s.score + s.comments * 0.3;
    if (score < 40) continue;
    candidatePool.push({
      name: s.title,
      type: "project",
      sources: ["hackernews"],
      summary: `Show HN project with ${s.score} upvotes and ${s.comments} comments.`,
      alpha_thesis: "HN-validated tool; early adopters are engaged.",
      risk: "Show HN hype may not translate to real adoption.",
      _score: score / 20,
    });
  }

  // From Research/ML: high-likes models
  for (const m of trendingModels) {
    if ((m.likes || 0) < 500) continue;
    const tags = (m.tags || []).join(", ").toLowerCase();
    if (!hasAny(tags, AI_AGENT_KW)) continue;
    candidatePool.push({
      name: m.id,
      type: "tech",
      sources: ["huggingface"],
      summary: `Hugging Face model with ${m.likes} likes; tags: ${(m.tags || []).slice(0, 3).join(", ")}.`,
      alpha_thesis: "High community interest; may enable new AI workflows.",
      risk: "Research-grade; may not be production-ready.",
      _score: m.likes / 200,
    });
  }

  // From Jobs: emerging roles with multiple postings
  for (const r of emergingRoles) {
    if (r.count < 2) continue;
    const tags = (r.why_signal || "").toLowerCase();
    if (!hasAny(tags, ["strong demand", "multiple postings"])) continue;
    candidatePool.push({
      name: r.role,
      type: "trend",
      sources: ["jobs"],
      summary: `${r.count} job postings; companies: ${r.example_companies.join(", ")}.`,
      alpha_thesis: "Rising demand for this role; signals market shift.",
      risk: "May be short-term hiring spike.",
      _score: r.count * 2,
    });
  }

  // From cross-source overlaps
  for (const o of overlapCandidates) {
    candidatePool.push({
      name: o.name,
      type: "project",
      sources: o.sources,
      summary: `Appears across ${o.sources.join(", ")}: ${o.reason}.`,
      alpha_thesis: "Multi-source validation; not isolated hype.",
      risk: "Correlated noise possible; verify independently.",
      _score: o.sources.size * 3,
    });
  }

  // Sort by score, pick top candidates (5-15 depending on quality)
  candidatePool.sort((a, b) => b._score - a._score);
  const candidates = candidatePool
    .slice(0, 15)
    .filter(c => c._score >= 2)
    .map((c, i) => {
      const { _score, ...rest } = c;
      return { id: i + 1, ...rest };
    })
    .slice(0, 12);

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
