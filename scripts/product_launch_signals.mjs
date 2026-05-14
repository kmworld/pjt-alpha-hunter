#!/usr/bin/env node
// product_launch_signals.mjs
// Collects:
// - Product Hunt (via fetch with stealth headers; fallback to empty)
// - IndieHackers (direct fetch)
// - Y Combinator (direct fetch)
// Output: data/product_launch_<YYYY-MM-DD>.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchHtml(url, label) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.log(`[${label}] HTTP ${res.status}, treating as fail`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.log(`[${label}] Request failed: ${e.message}`);
    return null;
  }
}

function stripTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function limitLength(s, max) {
  s = (s || "").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Product Hunt: use OpenClaw browser tool to bypass 403

function runBrowserCommand(cmd) {
  const out = execSync(cmd, { encoding: "utf-8", timeout: 20000 });
  return (out ?? "").toString().trim();
}

async function fetchProductHunt() {
  try {
    // 1) Open Product Hunt in OpenClaw browser
    const openOut = runBrowserCommand(
      'openclaw browser open "https://www.producthunt.com/"'
    );
    // Example output:
    // opened: https://www.producthunt.com/
    // tab: t8
    // id: 339EF9EBB8ABC24459D2CD9E0A83FFB1
    const idMatch = openOut.match(/id:\s*(\S+)/);
    const targetId = idMatch ? idMatch[1] : null;
    if (!targetId) {
      console.log("[ProductHunt] No targetId from browser open");
      return [];
    }

    // 2) Wait for page load
    await new Promise((r) => setTimeout(r, 4000));

    // 3) Take accessibility snapshot
    const snapOut = runBrowserCommand(
      `openclaw browser snapshot --target-id "${targetId}"`
    );
    const snapText = typeof snapOut === "string" ? snapOut : JSON.stringify(snapOut);

    // Debug: inspect first 1000 chars if empty
    if (!snapText || snapText.length < 100) {
      console.log(`[ProductHunt] Snapshot too short (${snapText?.length || 0}): ${snapText?.slice(0, 200)}`);
      return [];
    }

    // 4) Parse products from snapshot text
    const products = parseProductHuntFromSnapshot(snapText);
    console.log(`[ProductHunt] Parsed ${products.length} products via browser`);
    return products.slice(0, 30);
  } catch (err) {
    console.log(`[ProductHunt] Browser fetch failed: ${err.message || err}`);
    return [];
  }
}

function parseProductHuntFromSnapshot(text) {
  // The aria snapshot includes lines like:
  // link "1. Memoket Gem" [ref=e36]:
  //   /url: /products/memoket-gem
  //   text: 1. Memoket Gem
  // generic [ref=e38]: An AI wearable that remembers your conversations all day
  // button "248" [ref=e43]:
  const products = [];
  const seen = new Set();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match product link: link "1. Name" or link "Name"
    const rankMatch = line.match(
      /link\s+"(\d+\.\s+.+)"/ 
    );
    if (!rankMatch) continue;

    const rawName = rankMatch[1].trim();
    const name = rawName.replace(/^\d+\.\s+/, "").trim();
    if (!name || name.length < 3 || name.length > 120) continue;
    if (seen.has(name)) continue;

    // Find URL in next few lines
    let url = null;
    for (
      let j = i + 1;
      j < Math.min(i + 4, lines.length);
      j++
    ) {
      const urlMatch = lines[j].match(
        /\/url:\s*(\/products\/[^\s]+)/
      );
      if (urlMatch) {
        url = "https://www.producthunt.com" + urlMatch[1];
        break;
      }
    }

    // Find tagline in next lines
    let tagline = "";
    for (
      let j = i + 1;
      j < Math.min(i + 6, lines.length);
      j++
    ) {
      const tlLine = lines[j].trim();
      // generic [ref=...]: short description
      const tlMatch = tlLine.match(
        /generic\s+\[ref=\w+\]:\s+(.+)$/ 
      );
      if (tlMatch && tlMatch[1].length > 15 && tlMatch[1].length < 200) {
        tagline = tlMatch[1].trim();
        break;
      }
    }

    // Votes: button "248"
    let votes = null;
    for (
      let j = i + 1;
      j < Math.min(i + 8, lines.length);
      j++
    ) {
      const vMatch = lines[j].match(
        /button\s+"(\d{2,4})"/ 
      );
      if (vMatch && parseInt(vMatch[1], 10) >= 50) {
        votes = parseInt(vMatch[1], 10);
        break;
      }
    }

    if (!url) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40);
      url = `https://www.producthunt.com/products/${slug}`;
    }

    if (products.length >= 30) break;

    products.push({
      name: limitLength(name, 120),
      tagline: limitLength(tagline, 200),
      votes,
      tags: [],
      url,
    });

    seen.add(name);
  }

  return products;
}

// IndieHackers: collect notable posts from homepage

async function fetchIndieHackers() {
  const html = await fetchHtml(
    "https://www.indiehackers.com/",
    "IndieHackers"
  );
  if (!html) {
    console.log("[IndieHackers] No HTML, returning empty array");
    return [];
  }

  const posts = [];

  const linkPattern =
    /<a[^>]*href="([^"]+)"[^>]*>([^<]{15,250})<\/a>/gi;
  let m;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = limitLength(stripTags(m[2]), 180);

    if (
      !href.startsWith("/") ||
      href.includes("user") ||
      href.includes("pricing") ||
      href.includes("signup") ||
      href.includes("login") ||
      href.includes("about") ||
      text.length < 20
    ) {
      continue;
    }

    const url = "https://www.indiehackers.com" + href;

    if (posts.some((p) => p.url === url)) continue;

    const around = html.slice(
      Math.max(0, m.index - 300),
      m.index + 300
    );
    const descMatch = around.match(
      /<p[^>]*>([^<]{15,260})<\/p>/i
    );
    const description_short = descMatch
      ? limitLength(stripTags(descMatch[1]), 200)
      : "";

    posts.push({
      title: text,
      description_short,
      url,
    });

    if (posts.length >= 20) break;
  }

  console.log(`[IndieHackers] Parsed ${posts.length} posts`);
  return posts.slice(0, 20);
}

// Y Combinator: collect notable companies from public page

async function fetchYC() {
  const html = await fetchHtml(
    "https://www.ycombinator.com/companies",
    "YC"
  );
  if (!html) {
    console.log("[YC] No HTML from /companies, returning empty array");
    return [];
  }

  const companies = [];

  const linkPattern =
    /<a[^>]*href="([^"]+)"[^>]*>([^<]{3,120})<\/a>/gi;
  let m;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = limitLength(stripTags(m[2]), 120);

    if (
      !href.includes("ycombinator.com") ||
      text.length < 3 ||
      text.length > 100 ||
      href.includes("jobs") ||
      href.includes("apply") ||
      href.includes("blog")
    ) {
      continue;
    }

    const url =
      href.startsWith("http") ? href : "https://www.ycombinator.com" + href;

    if (companies.some((c) => c.url === url)) continue;

    const around = html.slice(
      Math.max(0, m.index - 300),
      m.index + 300
    );
    const descMatch = around.match(
      /<p[^>]*>([^<]{10,220})<\/p>/i
    );
    const description_short = descMatch
      ? limitLength(stripTags(descMatch[1]), 200)
      : "";

    companies.push({
      title: text,
      description_short,
      url,
    });

    if (companies.length >= 20) break;
  }

  console.log(`[YC] Parsed ${companies.length} companies`);
  return companies.slice(0, 20);
}

// Enrichment helpers: tags, why_notable, tech_domain

function classifyTechDomain(text) {
  const t = (text || "").toLowerCase();
  const aiWords = [
    "ai", "ai agent", "ai-powered", "generative ai", "llm", "language model",
    "artificial intelligence", "ai assistant", "ai-native", "ai workflow",
    "claude", "gpt", "copilot", "chatgpt", "deepseek", "gemini",
  ];
  const devWords = [
    "developer tool", "devtools", "sdk", "api", "cli", "build system",
    "compiler", "debugger", "runtime", "observability", "monitoring",
    "ci/cd", "infrastructure", "infra", "containers", "kubernetes",
    "serverless", "cloud", "platform", "backend", "database",
    "code", "coding", "refactor", "deploy", "workflow",
    "typescript", "javascript", "python", "rust", "go", "java",
    "terminal", "ide", "editor", "dev",
  ];
  const mktWords = [
    "marketing", "seo", "ads", "email marketing", "growth", "crm",
    "sales", "lead gen", "conversion", "funnel", "content marketing",
  ];
  const cryptoWords = [
    "crypto", "web3", "blockchain", "defi", "nft", "wallet",
    "solana", "ethereum", "bitcoin", "on-chain", "decentralized",
    "dapp", "dao", "web3",
  ];
  const consumerWords = [
    "social", "messaging", "chat", "video", "music", "photo",
    "lifestyle", "fitness", "wellness", "dating", "community",
    "productivity", "notes", "task", "planner",
  ];

  let aiScore = 0, devScore = 0, mktScore = 0, cryptoScore = 0, consumerScore = 0;
  for (const w of aiWords) if (t.includes(w)) aiScore += 2;
  for (const w of devWords) if (t.includes(w)) devScore += 1;
  for (const w of mktWords) if (t.includes(w)) mktScore += 1;
  for (const w of cryptoWords) if (t.includes(w)) cryptoScore += 2;
  for (const w of consumerWords) if (t.includes(w)) consumerScore += 1;

  const max = Math.max(aiScore, devScore, mktScore, cryptoScore, consumerScore, 0);
  if (max === 0) return "other";
  if (aiScore === max) return "ai-agent";
  if (devScore === max) return "devtools";
  if (mktScore === max) return "marketing";
  if (cryptoScore === max) return "crypto";
  if (consumerScore === max) return "consumer";
  return "other";
}

function generateTags(text) {
  const t = (text || "").toLowerCase();
  const tags = new Set();
  const addIf = (cond, tag) => { if (cond) tags.add(tag); };

  addIf(t.includes("ai") || t.includes("agent") || t.includes("llm") || t.includes("claude") || t.includes("gpt"), "AI");
  addIf(t.includes("dev") || t.includes("developer") || t.includes("sdk") || t.includes("api") || t.includes("code"), "DevTools");
  addIf(t.includes("marketing") || t.includes("seo") || t.includes("ads"), "Marketing");
  addIf(t.includes("infra") || t.includes("cloud") || t.includes("serverless") || t.includes("kubernetes"), "Infrastructure");
  addIf(t.includes("crypto") || t.includes("web3") || t.includes("blockchain"), "Crypto/Web3");
  addIf(t.includes("saas") || t.includes("platform"), "SaaS");
  addIf(t.includes("startup"), "Startup");
  addIf(t.includes("productivity") || t.includes("workflow"), "Productivity");
  addIf(t.includes("analytics") || t.includes("metrics"), "Analytics");
  addIf(t.includes("design") || t.includes("ui"), "Design");
  addIf(t.includes("open source") || t.includes("oss"), "Open Source");
  addIf(t.includes("finance") || t.includes("fintech") || t.includes("payments"), "Finance");
  addIf(t.includes("security") || t.includes("auth"), "Security");
  addIf(t.includes("wearable") || t.includes("hardware"), "Hardware");
  addIf(t.includes("ui") || t.includes("living ui") || t.includes("interface"), "UX/UI");

  const arr = [...tags];
  return arr.length > 5 ? arr.slice(0, 5) : arr;
}

function generateWhyNotable(item) {
  const text = [item.name || item.title, item.tagline || item.description_short].join(" ").toLowerCase();
  const votes = item.votes || 0;
  const parts = [];

  if (votes >= 300) parts.push("High traction");
  else if (votes >= 100) parts.push("Strong early interest");

  if (text.includes("ai") || text.includes("agent")) parts.push("AI-native");
  if (text.includes("yc") || text.includes("y combinator")) parts.push("YC-backed");
  if (text.includes("open source")) parts.push("Open-source friendly");

  if (parts.length === 0) {
    if (text.includes("ai")) parts.push("Emerging AI tool");
    else parts.push("Notable new launch");
  }

  const base = parts.join("; ");
  return base.length > 140 ? base.slice(0, 140) + "…" : base;
}

function enrichItem(item, source) {
  const text = [item.name || item.title, item.tagline || item.description_short || ""].join(" ");
  const tech_domain = classifyTechDomain(text);
  const tags = generateTags(text);
  const why_notable = generateWhyNotable(item);
  return { ...item, tech_domain, tags, why_notable };
}

// Main

async function run() {
  const date = todayISO();
  const dateDir = path.join(dataDir, date);

  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }

  const [product_hunt, indiehackers, yc] = await Promise.all([
    fetchProductHunt(),
    fetchIndieHackers(),
    fetchYC(),
  ]);

  const hasData =
    product_hunt.length > 0 || indiehackers.length > 0 || yc.length > 0;

  if (!hasData) {
    console.log("[product_launch] All sources failed; exiting 1");
    process.exit(1);
  }

  const enrichedProductHunt = product_hunt.map((p) => enrichItem(p, "product_hunt"));
  const enrichedIndieHackers = indiehackers.map((p) => enrichItem(p, "indiehackers"));
  const enrichedYC = yc.map((p) => enrichItem(p, "yc"));

  const payload = {
    source: "product_launch",
    date,
    product_hunt: enrichedProductHunt,
    indiehackers: enrichedIndieHackers,
    yc: enrichedYC,
  };

  const outPath = path.join(dateDir, `product_launch.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(
    `[product_launch] Wrote → ${outPath} (PH:${product_hunt.length}, IH:${indiehackers.length}, YC:${yc.length})`
  );
}

run().catch((err) => {
  console.error("[product_launch] Fatal error:", err);
  process.exit(1);
});
