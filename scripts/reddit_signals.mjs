#!/usr/bin/env node
// scripts/reddit_signals.mjs
// Collects:
//  - Top posts from selected subreddits
//  - Hot / trending subreddits from popular/rising feeds
// No external dependencies; Node 22+ fetch only.

const SUBREDDITS = [
  "futurology",
  "technology",
  "startups",
  "opensource",
  "cybersecurity",
  "cryptocurrency",
];

const KEYWORDS = [
  "ai",
  "llm",
  "agent",
  "agentic",
  "nvidia",
  "startup",
  "crypto",
  "defi",
  "blockchain",
  "web3",
  "open-source",
  "cybersecurity",
  "infra",
  "automation",
  "saas",
  "ml",
  "deep learning",
  "runtime",
  "observability",
  "edge ai",
  "ai infra",
];

const TODAY = new Date();
const DATE_STR = TODAY.toISOString().slice(0, 10); // YYYY-MM-DD

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const UA = {
  "User-Agent":
    "AlphaHunter/1.0 (by /u/alpha_hunter_bot) - Data collection for research",
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) {
      console.error(`[reddit] HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[reddit] Error fetching ${url}: ${err.message}`);
    return null;
  }
}

async function fetchTopComments(permalink) {
  if (!permalink) return null;
  const url = `https://www.reddit.com${permalink}.json`;
  const json = await fetchJson(url);
  if (!json || !Array.isArray(json) || json.length < 2) return null;
  // json[1] is comments array
  const comments = (json[1]?.data?.children || [])
    .map(c => c.data?.body || "")
    .filter(b => b.trim().length > 30);
  if (comments.length === 0) return null;
  // Take up to 5 comments, total up to 600 chars
  const taken = comments.slice(0, 5);
  let out = "";
  for (const c of taken) {
    if (out.length + c.length + 20 > 600) break;
    if (out) out += "\n\n";
    out += c.trim();
  }
  return out.trim();
}

async function fetchSubreddit(sub) {
  const url = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=30`;
  const json = await fetchJson(url);
  if (!json || !json.data?.children) return null;

  const posts = [];
  const MIN_SCORE = 100;
  const MIN_COMMENTS = 15;
  const MAX_POSTS = 15;

  // Sort by score descending; we want hot posts only
  const sorted = (json.data.children || []).slice().sort((a, b) => (b.data.score || 0) - (a.data.score || 0));

  for (const c of sorted) {
    if (posts.length >= MAX_POSTS) break;
    const d = c.data;

    const score = d.score ?? 0;
    const comments = d.num_comments ?? 0;

    // Skip low-engagement posts
    if (score < MIN_SCORE || comments < MIN_COMMENTS) continue;

    const redditPostUrl = (d.permalink
      ? `https://www.reddit.com${d.permalink}`
      : d.url || "");

    const selftext = (d.selftext || "").trim();
    const isLinkPost = !selftext || selftext.length < 20;
    let selftextShort = null;

    if (!isLinkPost) {
      selftextShort = selftext.length > 1200 ? selftext.slice(0, 1200) : selftext;
    } else if (comments > 0) {
      // For link posts with comments, fetch top comments as context
      try {
        selftextShort = await fetchTopComments(d.permalink);
      } catch {
        // ignore errors, keep null
      }
    }

    const whyHot = buildWhyHot(d.title, selftextShort);

    posts.push({
      title: d.title || "",
      url: redditPostUrl,
      score,
      comments,
      link_post: isLinkPost,
      selftext_short: selftextShort || null,
      why_hot: whyHot || null,
    });
  }

  return { name: `r/${sub}`, posts };
}

function hasKeyword(text) {
  const lower = (text || "").toLowerCase();
  return KEYWORDS.some((k) => {
    if (k.length <= 2) {
      // Use word boundary for short tokens (e.g. "ai", "llm")
      const re = new RegExp("\\b" + k + "\\b");
      return re.test(lower);
    }
    // Longer phrases: simple includes is okay
    return lower.includes(k);
  });
}

function buildWhyHot(title, selftextShort) {
  const t = (title || "").trim();
  const s = (selftextShort || "").trim();
  const text = (t + " " + s).trim();
  const lower = text.toLowerCase();

  // Detect key themes (only as internal signals, not printed verbatim)
  const hasAI = /\b(ai|llm|gpt|diffusion|transformer|deep\s+learning|ml|foundation\s+model|multimodal|agentic|agent)\b/.test(lower);
  const hasCrypto = /\b(crypto|bitcoin|btc|eth|ethereum|sol|solana|web3|defi|nft|dao|stablecoin|rollup)\b/.test(lower);
  const hasSecurity = /\b(cybersecurity|exploit|vulnerability|cve|zero-day|0-day|phishing|ransomware|data\s+leak|breach|security)\b/.test(lower);
  const hasStartup = /\b(startup|y\s*combinator|yc|fund|seed|series\s*[a-z]|valuation|acquisition|exit|layoff|fired)\b/.test(lower);
  const hasInfra = /\b(infra|cloud|kubernetes|k8s|serverless|edge|observability|telemetry|sre|devops|ci\/cd)\b/.test(lower);
  const hasOSS = /\b(open\s*source|oss|contribut|pull\s*request|fork|maintainer)\b/.test(lower);

  // Detect event-type signals
  const isLaunch = /\b(launch|launching|released|release|announced|announcing|debuted)\b/.test(lower);
  const isIncident = /\b(breach|leak|exploit|vulnerability|zero-day|ransomware|incident|outage|down|downtime)\b/.test(lower);
  const isMoney = /\b(fund|raised|valuation|acqui|ipo|listing|token|raise|seed|series)\b/.test(lower);
  const isRegulation = /\b(regulat|ban|restriction|policy|law|legislation|compliance|ftc|sec|eu\s+ai)\b/.test(lower);
  const isOrgChange = /\b(layoff|fire|fired|cut|downsize|quit|resign|stepping\s+down|ceo)\b/.test(lower);
  const isHype = /\b(breakthrough|disrupt|major|big|huge|massive|critical|urgent)\b/.test(lower);

  // Build a concise, specific explanation (1–2 lines)
  // Strategy: describe what the post is about and why it's hot, without generic labels

  let why = "";

  // If title already tells the story clearly, anchor on that
  if (t.length > 20 && t.length < 150) {
    why = t;
  } else if (t.length >= 150) {
    why = t.slice(0, 140).trim().replace(/\s+$/, "") + "...";
  } else {
    // Very short title: fall back to neutral summary
    why = "Trending discussion";
  }

  // Add a short contextual note only if we detect a clear signal
  const notes = [];

  if (isIncident) {
    notes.push("likely drawing attention due to a security incident or outage");
  } else if (isMoney) {
    notes.push("likely drawing attention due to funding, valuation, or market movement");
  } else if (isLaunch) {
    notes.push("likely drawing attention as a new launch or announcement");
  } else if (isRegulation) {
    notes.push("likely drawing attention due to regulation or policy changes");
  } else if (isOrgChange) {
    notes.push("likely drawing attention due to organizational or leadership changes");
  } else if (isHype) {
    notes.push("likely drawing attention due to a high-impact or controversial development");
  } else if (hasAI || hasInfra || hasOSS) {
    notes.push("relevant to AI, infrastructure, or open-source ecosystem movements");
  } else if (hasCrypto) {
    notes.push("relevant to crypto, blockchain, or DeFi ecosystem movements");
  } else if (hasSecurity) {
    notes.push("relevant to cybersecurity and risk tracking");
  } else if (hasStartup) {
    notes.push("relevant to startup ecosystem and funding activity");
  }

  if (notes.length > 0) {
    why = why + ". " + notes.join("; ");
  }

  // If we have rich selftext/comments, include a short snippet to add depth
  if (s && s.length > 40 && s.length <= 160) {
    const snippet = s.trim().replace(/\n+/g, " ").slice(0, 140);
    if (!why.toLowerCase().includes(snippet.toLowerCase().slice(0, 60))) {
      why = why + ". " + snippet;
    }
  }

  return why.trim();
}

async function scanPopularRising() {
  // Collect subreddit frequency and sample titles from popular/rising
  const subCounts = new Map();
  const subSamples = new Map();

  const endpoints = [
    "https://www.reddit.com/r/all/top.json?t=day&limit=50",
    "https://www.reddit.com/best.json?t=day&limit=50",
    "https://www.reddit.com/r/popular/top.json?t=day&limit=50",
  ];

  for (const url of endpoints) {
    const json = await fetchJson(url);
    const children = json?.data?.children || [];
    for (const c of children) {
      const d = c.data;
      const sub = d.subreddit;
      const title = d.title || "";
      if (!sub) continue;

      // Only consider subreddits where title or sub name includes relevant keywords
      if (!hasKeyword(title + " " + sub)) continue;

      const key = `r/${sub}`;
      subCounts.set(key, (subCounts.get(key) || 0) + 1);

      if (!subSamples.has(key)) {
        subSamples.set(key, []);
      }
      const samples = subSamples.get(key);
      if (samples.length < 5) {
        samples.push(title);
      }
    }

    // polite delay
    await sleep(350 + Math.floor(Math.random() * 200));
  }

  // Build hot_subreddits list excluding fixed subreddits
  const fixedSet = new Set(SUBREDDITS.map((s) => `r/${s}`));
  const hotSubreddits = [];

  for (const [sub, count] of subCounts.entries()) {
    if (fixedSet.has(sub)) continue;
    if (count < 1) continue; // lower threshold from 2 to 1 for better coverage

    hotSubreddits.push({
      name: sub,
      post_count: count,
      sample_titles: subSamples.get(sub) || [],
    });
  }

  // Sort by post_count descending
  hotSubreddits.sort((a, b) => b.post_count - a.post_count);
  return hotSubreddits;
}

function buildPostSummary(title, selftextShort, whyHot) {
  const t = (title || "").trim();
  const s = (selftextShort || "").trim();
  const lines = [];

  if (t.length > 0) {
    lines.push(t);
  }

  if (s && s.length > 20) {
    const snippet = s.replace(/\n+/g, " ").trim();
    const cut = snippet.length > 180 ? snippet.slice(0, 180).trimEnd() + "..." : snippet;
    if (!t.toLowerCase().includes(cut.toLowerCase().slice(0, 40))) {
      lines.push(cut);
    }
  }

  if (whyHot && whyHot.length > 10 && !t.toLowerCase().includes(whyHot.toLowerCase().slice(0, 40))) {
    lines.push(whyHot);
  }

  // Keep to 2-4 lines max, under 320 chars total
  let out = lines.join(" ").trim();
  if (out.length > 320) {
    out = out.slice(0, 317).trimEnd() + "...";
  }
  return out || t;
}

function buildGlobalHotPosts(allSubreddits) {
  const allPosts = [];

  for (const sub of allSubreddits) {
    const name = sub.name || "";
    for (const p of sub.posts || []) {
      allPosts.push({
        ...p,
        subreddit: name,
      });
    }
  }

  // Sort by engagement-weighted score: score * 1 + comments * 0.2
  allPosts.sort((a, b) => {
    const scoreA = (a.score || 0) + (a.comments || 0) * 0.2;
    const scoreB = (b.score || 0) + (b.comments || 0) * 0.2;
    return scoreB - scoreA;
  });

  // Take top 30
  const top30 = allPosts.slice(0, 30);

  return top30.map(p => ({
    url: p.url || "",
    title: p.title || "",
    score: p.score || 0,
    comments: p.comments || 0,
    subreddit: p.subreddit || "",
    post_summary: buildPostSummary(p.title, p.selftext_short, p.why_hot),
    why_hot: p.why_hot || "",
  }));
}

function buildEmergingSubreddits(hotSubreddits) {
  if (!hotSubreddits || hotSubreddits.length === 0) return [];

  // Filter to those with multiple hot posts and AI/tech/crypto/startup flavor
  const result = hotSubreddits
    .filter(s => s.post_count >= 2)
    .slice(0, 6)
    .map(s => {
      const reason =
        `Multiple hot posts (${s.post_count}) in AI/tech/crypto/startup spaces; rising community interest.`;
      return {
        name: s.name,
        reason,
        sample_posts: (s.sample_titles || []).slice(0, 3),
      };
    });

  return result;
}

(async () => {
  const subreddits = [];
  let anySuccess = false;

  // 1) Fixed subreddits
  for (const sub of SUBREDDITS) {
    const result = await fetchSubreddit(sub);
    if (result) {
      subreddits.push(result);
      anySuccess = true;
    }
    await sleep(300 + Math.floor(Math.random() * 200));
  }

  // 2) Hot subreddit discovery
  const hotSubreddits = await scanPopularRising();
  if (hotSubreddits.length > 0) {
    anySuccess = true;
  }

  if (!anySuccess) {
    console.error("[reddit] All sources failed; exiting 1");
    process.exit(1);
  }

  // 3) Build global hot posts and emerging subreddits
  const globalHotPosts = buildGlobalHotPosts(subreddits);
  const emergingSubreddits = buildEmergingSubreddits(hotSubreddits);

  const payload = {
    source: "reddit",
    date: DATE_STR,
    subreddits,
    hot_subreddits: hotSubreddits,
    global_hot_posts: globalHotPosts,
    emerging_subreddits: emergingSubreddits,
  };

  // Ensure date-based data directory exists
  const fs = await import("fs");
  const path = await import("path");
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const dataDir = path.join(rootDir, "data");
  const outDir = path.join(dataDir, DATE_STR);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fullPath = path.join(outDir, `reddit.json`);
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[reddit] Written to: ${fullPath}`);
})();
