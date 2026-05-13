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

// Product Hunt: parse from HTML if available

async function fetchProductHunt() {
  const html = await fetchHtml("https://www.producthunt.com/", "ProductHunt");
  if (!html) {
    console.log("[ProductHunt] No HTML, returning empty array");
    return [];
  }

  const products = [];
  const seen = new Set();

  // Look for product-like blocks:
  // - link with "/products/..." and rank text
  // - tagline nearby
  // - upvote count nearby

  const productLinks = [...html.matchAll(/<a[^>]*href="([^"]*\/products\/[^"]+)"[^>]*>(.*?)<\/a>/gis)];

  for (const m of productLinks) {
    const href = m[1];
    const linkText = stripTags(m[2]).trim();
    const idx = m.index;
    const around = html.slice(Math.max(0, idx - 400), idx + 400);

    // Extract name: often "1. Name" or similar
    const nameMatch = linkText.match(/^\d+\.\s+(.+)$/);
    const name = (nameMatch && nameMatch[1].trim()) || linkText;

    if (!name || name.length < 3 || name.length > 120) continue;
    if (seen.has(name)) continue;

    // Extract tagline: short description near product
    const taglineMatch = around.match(
      /<[^>]*class="[^"]*description[^"]*"[^>]*>([^<]{15,200})<\/[^>]+>/i
    );
    const tagline = (taglineMatch && stripTags(taglineMatch[0])) ||
                    (around.match(/<[^>]*class="[^"]*tagline[^"]*"[^>]*>([^<]{15,200})<\/[^>]+>/i)
                      ? stripTags(around.match(/<[^>]*class="[^"]*tagline[^"]*"[^>]*>([^<]{15,200})<\/[^>]+>/i)[0])
                      : "");

    // Extract votes: number near "upvotes"
    const votesMatch = around.match(/(\d[\d,]*)\s*upvotes?/i);
    const votes = votesMatch
      ? parseInt(votesMatch[1].replace(/,/g, ""), 10)
      : null;

    const url = href.startsWith("http")
      ? href
      : "https://www.producthunt.com" + href;

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

  console.log(`[ProductHunt] Parsed ${products.length} products`);
  return products.slice(0, 30);
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
