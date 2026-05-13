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

async function fetchSubreddit(sub) {
  const url = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=30`;
  const json = await fetchJson(url);
  if (!json || !json.data?.children) return null;

  const posts = (json.data.children || []).map((c) => {
    const d = c.data;
    return {
      title: d.title || "",
      url: d.url || "",
      score: d.score ?? 0,
      comments: d.num_comments ?? 0,
    };
  });

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

async function scanPopularRising() {
  // Collect subreddit frequency and sample titles from popular/rising
  const subCounts = new Map();
  const subSamples = new Map();

  const endpoints = [
    "https://www.reddit.com/r/all/top.json?t=day&limit=50",
    "https://www.reddit.com/best.json?t=day&limit=50",
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
    if (count < 2) continue; // require at least 2 appearances

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

  const payload = {
    source: "reddit",
    date: DATE_STR,
    subreddits,
    hot_subreddits: hotSubreddits,
  };

  // Ensure data directory exists
  const fs = await import("fs");
  const path = await import("path");
  const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const outDir = path.join(rootDir, "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const fullPath = path.join(outDir, `reddit_${DATE_STR}.json`);
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[reddit] Written to: ${fullPath}`);
})();
