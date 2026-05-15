#!/usr/bin/env node
// hn_signals.mjs
// Collects Hacker News top stories + Show HN via Firebase API.
// Enriched with:
//  - article_summary (from linked article, when available)
//  - comment_highlights (top-level comments for high-engagement posts)
// Concurrency + timeouts + error isolation to avoid slow runs and 429/403.
// Output: data/<YYYY-MM-DD>/hackernews.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const TOP_STORIES_LIMIT = 50;
const DELAY_MS = 30;

// Concurrency limits
const ARTICLE_FETCH_CONCURRENCY = 5;
const COMMENT_FETCH_CONCURRENCY = 10;

// Throttles / limits
const ARTICLE_TIMEOUT_MS = 4_000;
const COMMENT_PER_STORY_LIMIT = 20;
const MAX_COMMENT_CHARS = 260;
const MAX_ARTICLE_CHARS = 1_500;

// Engagement thresholds
const HIGH_ENGAGEMENT_SCORE = 150;
const HIGH_ENGAGEMENT_COMMENTS = 60;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    console.error(`[HN] Fetch failed: ${url} status=${res.status}`);
    process.exit(1);
  }
  return res.json();
}

// ---------- Concurrency limiter ----------

async function limitedMap(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        console.error(`[HN] Error in limitedMap at index ${i}:`, err.message || err);
        results[i] = null;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------- HTML → short readable summary ----------

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchArticleSummary(url) {
  if (!url || !url.startsWith("http")) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ARTICLE_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok || !res.body) return null;

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("html")) return null;

    const text = await res.text();
    const cleaned = stripHtml(text);
    const trimmed = cleaned.slice(0, MAX_ARTICLE_CHARS * 2).trim();
    if (trimmed.length < 120) return null;

    // Take first meaningful chunk (avoid footer noise)
    const lines = trimmed.split("\n").map(l => l.trim()).filter(Boolean);
    let out = lines.join(" ").slice(0, MAX_ARTICLE_CHARS).trim();
    if (out.length < 80) return null;
    return out;
  } catch {
    return null;
  }
}

// ---------- Comments via Firebase ----------

async function fetchTopComments(storyId) {
  try {
    const story = await fetchJSON(
      `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
    );
    const kids = Array.isArray(story?.kids) ? story.kids : [];
    if (!kids.length) return [];

    const commentIds = kids.slice(0, COMMENT_PER_STORY_LIMIT);
    const comments = await limitedMap(commentIds, COMMENT_FETCH_CONCURRENCY, async (id) => {
      try {
        const c = await fetchJSON(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );
        if (!c || !c.text) return null;
        const text = c.text
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!text || text.length < 20) return null;
        return {
          by: c.by || null,
          text: text.slice(0, MAX_COMMENT_CHARS),
        };
      } catch {
        return null;
      }
    });

    return comments.filter(Boolean);
  } catch {
    return [];
  }
}

// ---------- Category classification ----------

function classifyCategory(text) {
  const t = (text || "").toLowerCase();

  if (/\b(ai|llm|gpt|transformer|diffusion|ml|machine learning|deep learning|agent|agentic|multimodal|foundation model|reasoning model)\b/.test(t))
    return "ai-ml";

  if (/\b(crypto|bitcoin|btc|eth|ethereum|sol|solana|web3|defi|nft|dao|blockchain|zk[- ]?proof)\b/.test(t))
    return "crypto";

  if (/\b(cybersecurity|security|exploit|zero[- ]day|vulnerability|cve|ransomware|phishing|hardening)\b/.test(t))
    return "security";

  if (/\b(infra|kubernetes|k8s|cloud|serverless|edge|observability|devops|sre|container|distributed)\b/.test(t))
    return "infra";

  if (/\b(science|physics|biology|neuro|medicine|climate|space)\b/.test(t))
    return "science";

  if (/\b(career|job|resume|salary|startup|raise|fund|acquisition|y combinator)\b/.test(t))
    return "career";

  if (/\b(business|finance|fintech|saas|sales|marketing|b2b|b2c)\b/.test(t))
    return "business";

  if (/\b(lifestyle|productivity|habit|health|fitness|minimalism)\b/.test(t))
    return "lifestyle";

  return "other";
}

function buildWhyHot(title, score, comments, category) {
  const t = (title || "").trim();
  const isShowHn = t.toUpperCase().includes("SHOW HN");

  if (isShowHn) {
    if (score >= 200 || comments >= 80)
      return `High-engagement Show HN; strong community validation for a new tool/product.`;
    return `Show HN submission with meaningful interest; early traction worth watching.`;
  }

  if (score >= 500 && comments >= 200)
    return `Major discussion across HN; indicates broad impact beyond niche audience.`;

  if (score >= 200 && comments >= 80)
    return `Strong HN engagement; likely important development in ${category || "tech"}.`;

  if (category === "ai-ml")
    return `AI/ML topic with notable HN attention; relevant to agent, model, or infra trends.`;
  if (category === "crypto")
    return `Crypto/Web3 topic gaining HN discussion; watch for protocol or regulatory implications.`;
  if (category === "security")
    return `Security incident or tool with high HN interest; may affect infra or AI safety.`;
  if (category === "infra")
    return `Infra/DevOps topic with HN traction; signals shifts in tooling or architecture.`;
  if (category === "career")
    return `Career/startup discussion; reflects market sentiment or hiring trends.`;
  if (category === "business")
    return `Business/market signal with HN attention; useful for trend and funding insights.`;
  if (category === "science")
    return `Science/tech story with HN interest; potential real-world impact.`;

  return `HN story with meaningful engagement; relevant tech discussion.`;
}

// ---------- Main ----------

async function run() {
  const date = todayISO();
  const dateDir = path.join(dataDir, date);

  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  // 1. Get top story IDs
  const ids = await fetchJSON(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );

  const top = [];
  const showHn = [];

  // 2. Fetch basic story data
  const stories = [];

  for (let i = 0; i < Math.min(ids.length, TOP_STORIES_LIMIT); i++) {
    const id = ids[i];
    const item = await fetchJSON(
      `https://hacker-news.firebaseio.com/v0/item/${id}.json`
    );

    const title = (item.title || "").trim();
    const isShowHn =
      typeof title === "string" && title.toUpperCase().includes("SHOW HN");

    const category_hint = classifyCategory(title);
    const why_hot = buildWhyHot(title, item.score || 0, item.descendants || 0, category_hint);

    const base = {
      id: item.id,
      title,
      url: item.url || null,
      score: item.score || 0,
      comments: item.descendants || 0,
      category_hint,
      why_hot,
    };

    stories.push({
      base,
      isShowHn,
    });

    if (isShowHn) {
      showHn.push(base);
    } else {
      top.push(base);
    }

    // Polite delay between story fetches
    if (i < Math.min(ids.length, TOP_STORIES_LIMIT) - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 3. Enrich with article_summary (parallel, limited concurrency)
  const articleSummaries = await limitedMap(
    stories.map(s => s.base),
    ARTICLE_FETCH_CONCURRENCY,
    async (story) => {
      if (!story.url) return null;
      return await fetchArticleSummary(story.url);
    }
  );

  // 4. Enrich high-engagement stories with comment_highlights
  const commentHighlights = await limitedMap(
    stories.map(s => s.base),
    COMMENT_FETCH_CONCURRENCY,
    async (story) => {
      const isHigh =
        (story.score >= HIGH_ENGAGEMENT_SCORE) ||
        (story.comments >= HIGH_ENGAGEMENT_COMMENTS);
      if (!isHigh) return null;
      return await fetchTopComments(story.id);
    }
  );

  // 5. Merge enrichments into final items
  for (let i = 0; i < stories.length; i++) {
    const story = stories[i];
    const item = story.isShowHn
      ? showHn.find(x => x.id === story.base.id)
      : top.find(x => x.id === story.base.id);

    if (!item) continue;

    item.article_summary = articleSummaries[i] || null;
    item.comment_highlights = (commentHighlights[i] && commentHighlights[i].length > 0)
      ? commentHighlights[i]
      : null;
  }

  const payload = {
    source: "hackernews",
    date,
    sections: {
      top,
      show_hn: showHn,
    },
  };

  const outPath = path.join(dateDir, `hackernews.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(
    `[HN] Wrote ${top.length} top + ${showHn.length} Show HN → ${outPath}`
  );
}

run().catch(err => {
  console.error("[HN] Fatal error:", err);
  process.exit(1);
});
