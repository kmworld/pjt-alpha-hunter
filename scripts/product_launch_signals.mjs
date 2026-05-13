#!/usr/bin/env node
// product_launch_signals.mjs
// Collects signals from:
// - Product Hunt (today's top products)
// - IndieHackers (notable posts)
// - Y Combinator (notable companies)
// Output: data/product_launch_<YYYY-MM-DD>.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchHtml(url, label) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
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

// Simple HTML helpers

function stripTags(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function limitLength(s, max) {
  s = (s || "").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function extractBetween(html, start, end) {
  const i = html.indexOf(start);
  if (i === -1) return null;
  const j = html.indexOf(end, i + start.length);
  if (j === -1) return html.slice(i + start.length);
  return html.slice(i + start.length, j);
}

// Product Hunt: parse today's top products from main page

async function fetchProductHunt() {
  const html = await fetchHtml("https://www.producthunt.com/", "ProductHunt");
  if (!html) {
    console.log("[ProductHunt] No HTML, returning empty array");
    return [];
  }

  const products = [];

  // Strategy: scan for product-like blocks: name + tagline + votes.
  // We'll use simple regex patterns over the HTML.

  // Try to grab "upvote" counts and nearby title/tagline.
  // Product Hunt HTML tends to have patterns like:
  // <span>234 upvotes</span> or similar.

  const upvotePattern = /(\d[\d,]*)\s*upvotes?/gi;
  let match;

  while ((match = upvotePattern.exec(html)) !== null) {
    const around = html.slice(Math.max(0, match.index - 600), match.index + 600);

    // Extract name: look for a nearby strong/h2/h3 or link text
    const nameMatch = around.match(
      /(?:<strong|<h[2-4]|<div)\b[^>]*>[^<]+<\/(?:strong|h[2-4]|div)>/i
    );
    const name = nameMatch ? stripTags(nameMatch[0]) : null;

    // Extract tagline: short description near product title
    const taglineMatch = around.match(
      /(?:<p|<span)\b[^>]*>([^<]{15,160})<\/(?:p|span)>/i
    );
    const tagline = taglineMatch ? stripTags(taglineMatch[0]) : null;

    // Extract URL: link near the product
    const urlMatch = around.match(/href="([^"]+producthunt[^"]+)"/i);
    const url = urlMatch ? "https://www.producthunt.com" + urlMatch[1] : null;

    // Extract tags: small spans near product
    const tags = [];
    const tagRegex = /<span[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/gi;
    let t;
    while ((t = tagRegex.exec(around)) !== null) {
      tags.push(limitLength(stripTags(t[1]), 40));
    }

    const votes = parseInt(match[1].replace(/,/g, ""), 10) || 0;

    if (name && !products.some((p) => p.name === name)) {
      products.push({
        name: limitLength(name, 120),
        tagline: limitLength(tagline, 200) || "",
        votes,
        tags: tags.slice(0, 6),
        url: url || "",
      });
    }

    if (products.length >= 30) break;
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

  // Look for post titles/links
  const linkPattern =
    /<a[^>]*href="([^"]+)"[^>]*>([^<]{15,250})<\/a>/gi;
  let m;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = limitLength(stripTags(m[2]), 180);

    // Only take post-style links
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

    // Avoid duplicates
    if (posts.some((p) => p.url === url)) continue;

    // Short description: text near the link
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

  // Look for company links and short descriptions
  const linkPattern =
    /<a[^>]*href="([^"]+)"[^>]*>([^<]{3,120})<\/a>/gi;
  let m;

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = limitLength(stripTags(m[2]), 120);

    // Only take company-style links
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

    // Short description near the link
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

  // Ensure data directory
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
