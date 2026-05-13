#!/usr/bin/env node
// scripts/reddit_signals.mjs
// Collects top posts from selected subreddits via Reddit public JSON.
// No external dependencies; Node 22+ fetch only.

const SUBREDDITS = [
  "futurology",
  "technology",
  "startups",
  "opensource",
  "cybersecurity",
  "cryptocurrency",
];

const TODAY = new Date();
const DATE_STR = TODAY.toISOString().slice(0, 10); // YYYY-MM-DD
const OUT_PATH = `data/reddit_${DATE_STR}.json`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubreddit(sub) {
  const url = `https://www.reddit.com/r/${sub}/top.json?t=day&limit=30`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "AlphaHunter/1.0 (by /u/alpha_hunter_bot) - Data collection for research",
      },
    });

    if (!res.ok) {
      console.error(`[reddit] Failed for r/${sub}: HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const children = json?.data?.children || [];
    const posts = children.map((c) => {
      const d = c.data;
      return {
        title: d.title || "",
        url: d.url || "",
        score: d.score ?? 0,
        comments: d.num_comments ?? 0,
      };
    });

    return {
      name: `r/${sub}`,
      posts,
    };
  } catch (err) {
    console.error(`[reddit] Error for r/${sub}: ${err.message}`);
    return null;
  }
}

(async () => {
  const subreddits = [];
  let anySuccess = false;

  for (const sub of SUBREDDITS) {
    const result = await fetchSubreddit(sub);
    if (result) {
      subreddits.push(result);
      anySuccess = true;
    }
    // polite delay between subreddits
    await sleep(300 + Math.floor(Math.random() * 200));
  }

  if (!anySuccess) {
    console.error("[reddit] All subreddits failed; exiting 1");
    process.exit(1);
  }

  const payload = {
    source: "reddit",
    date: DATE_STR,
    subreddits,
  };

  // Ensure data directory exists (via fs)
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
