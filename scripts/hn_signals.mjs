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

    const base = {
      id: item.id,
      title: title,
      url: item.url || null,
      score: item.score || 0,
      comments: item.descendants || 0,
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
