#!/usr/bin/env node
// hn_signals.mjs
// Collects Hacker News top stories and Show HN stories via Firebase API.
// Output: data/hackernews_<YYYY-MM-DD>.json
// Enriched with: category_hint, why_hot

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const TOP_STORIES_LIMIT = 50;
const DELAY_MS = 30;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[HN] Fetch failed: ${url}  status=${res.status}`);
    process.exit(1);
  }
  return res.json();
}

function classifyCategory(text) {
  const t = (text || "").toLowerCase();

  // ai-ml
  if (/\b(ai|llm|gpt|transformer|diffusion|ml|machine learning|deep learning|agent|agentic|multimodal|foundation model|reasoning model)\b/.test(t))
    return "ai-ml";

  // crypto (before generic "blockchain" noise)
  if (/\b(crypto|bitcoin|btc|eth|ethereum|sol|solana|web3|defi|nft|dao|blockchain|zk[- ]?proof)\b/.test(t))
    return "crypto";

  // security
  if (/\b(cybersecurity|security|exploit|zero[- ]day|vulnerability|cve|ransomware|phishing|hardening)\b/.test(t))
    return "security";

  // infra
  if (/\b(infra|kubernetes|k8s|cloud|serverless|edge|observability|devops|sre|container|distributed)\b/.test(t))
    return "infra";

  // science
  if (/\b(science|physics|biology|neuro|medicine|climate|space)\b/.test(t))
    return "science";

  // career
  if (/\b(career|job|resume|salary|startup|raise|fund|acquisition|y combinator)\b/.test(t))
    return "career";

  // business
  if (/\b(business|finance|fintech|saas|sales|marketing|b2b|b2c)\b/.test(t))
    return "business";

  // lifestyle
  if (/\b(lifestyle|productivity|habit|health|fitness|minimalism)\b/.test(t))
    return "lifestyle";

  return "other";
}

function buildWhyHot(title, score, comments, category) {
  const t = (title || "").trim();
  const isShowHn = t.toUpperCase().includes("SHOW HN");

  // Show HN
  if (isShowHn) {
    if (score >= 200 || comments >= 80)
      return `High-engagement Show HN; strong community validation for a new tool/product.`;
    return `Show HN submission with meaningful interest; early traction worth watching.`;
  }

  // Very hot: broad impact
  if (score >= 500 && comments >= 200)
    return `Major discussion across HN; indicates broad impact beyond niche audience.`;

  // Hot: strong engagement
  if (score >= 200 && comments >= 80)
    return `Strong HN engagement; likely important development in ${category || "tech"}.`;

  // Category-specific flavor
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

  // Fallback
  return `HN story with meaningful engagement; relevant tech discussion.`;
}

async function run() {
  const date = todayISO();

  // Ensure data directory
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. Get top story IDs
  const ids = await fetchJSON(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );

  const top = [];
  const showHn = [];

  // 2. Fetch each item (limited)
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
      title: title,
      url: item.url || null,
      score: item.score || 0,
      comments: item.descendants || 0,
      category_hint,
      why_hot,
    };

    if (isShowHn) {
      showHn.push(base);
    } else {
      top.push(base);
    }

    // Be polite
    if (i < Math.min(ids.length, TOP_STORIES_LIMIT) - 1) {
      await sleep(DELAY_MS);
    }
  }

  const payload = {
    source: "hackernews",
    date,
    sections: {
      top,
      show_hn: showHn,
    },
  };

  const outPath = path.join(dataDir, `hackernews_${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[HN] Wrote ${top.length} top + ${showHn.length} Show HN → ${outPath}`);
}

run().catch((err) => {
  console.error("[HN] Fatal error:", err);
  process.exit(1);
});
