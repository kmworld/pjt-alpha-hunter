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

// Main

async function run() {
  const date = todayISO();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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

  const payload = {
    source: "product_launch",
    date,
    product_hunt,
    indiehackers,
    yc,
  };

  const outPath = path.join(dataDir, `product_launch_${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(
    `[product_launch] Wrote → ${outPath} (PH:${product_hunt.length}, IH:${indiehackers.length}, YC:${yc.length})`
  );
}

run().catch((err) => {
  console.error("[product_launch] Fatal error:", err);
  process.exit(1);
});
