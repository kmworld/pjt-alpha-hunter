#!/usr/bin/env node
// hn_signals.mjs
// Collects Hacker News top stories and Show HN stories via Firebase API.
// Output: data/hackernews_<YYYY-MM-DD>.json

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
  if (/(ai|llm|gpt|transformer|diffusion|ml|machine learning|deep learning|agent|agentic|multimodal|foundation model|reasoning model)/.test(t)) return "ai-ml";
  if (/(infra|kubernetes|k8s|cloud|serverless|edge|observability|devops|sre|container|distributed)/.test(t)) return "infra";
  if (/(cybersecurity|security|exploit|zero-day|vulnerability|cve|ransomware|phishing|hardening)/.test(t)) return "security";
  if (/(crypto|bitcoin|btc|eth|ethereum|sol|solana|web3|defi|nft|dao|blockchain|zk)/.test(t)) return "crypto";
  if (/(science|physics|biology|neuro|medicine|medicine|climate|space)/.test(t)) return "science";
  if (/(career|job|resume|salary|startup|raise|fund|acquisition|y combinator)/.test(t)) return "career";
  if (/(lifestyle|productivity|habit|health|fitness|minimalism)/.test(t)) return "lifestyle";
  if (/(business|finance|fintech|startup|saas|sales|marketing|b2b|b2c)/.test(t)) return "business";
  return "other";
}

function buildWhyHot(title, score, comments) {
  const t = (title || "").trim();
  const cat = classifyCategory(t);
  const isShowHn = t.toUpperCase().includes("SHOW HN");

  // Concise, non-boilerplate explanation
  if (isShowHn) {
    if (score >= 200 || comments >= 80) {
      return `High-engagement Show HN; strong community validation for a new tool/product.`;
    }
    return `Show HN submission with meaningful interest; early traction worth watching.`;
  }

  if (score >= 500 && comments >= 200) {
    return `Major discussion across HN; indicates broad impact beyond niche audience.`;
  }
  if (score >= 200 && comments >= 80) {
    return `Strong HN engagement; likely important development in ${cat || "tech"}.`;
  }

  // Domain-specific hints
  if (cat === "ai-ml") {
    return `AI/ML topic with notable HN attention; relevant to agent, model, or infra trends.`;
  }
  if (cat === "crypto") {
    return `Crypto/Web3 topic gaining HN discussion; watch for protocol or regulatory implications.`;
  }
  if (cat === "security") {
    return `Security incident or tool with high HN interest; may affect infra or AI safety.`;
  }
  if (cat === "infra") {
    return `Infra/DevOps topic with HN traction; signals shifts in tooling or architecture.`;
  }
  if (cat === "career") {
    return `Career/startup discussion; reflects market sentiment or hiring trends.`;
  }

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
    const why_hot = buildWhyHot(title, item.score || 0, item.descendants || 0);

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
