// scripts/github_trending.mjs
// Fetch GitHub Trending (daily) via raw HTML and parse repos.
// Node 22+ built-in only. No npm installs.

const URL = "https://github.com/trending?since=daily";

function today() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseNumber(s) {
  if (!s) return null;
  const cleaned = s.replace(/,/g, "").replace(/[^0-9]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function fetchHTML() {
  const res = await fetch(URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub Trending fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseTrending(html) {
  const items = [];

  // Split into articles (each repo)
  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>/g;
  const positions = [];
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    positions.push(m.index);
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1] : html.length;
    const chunk = html.slice(start, end);

    // Repo path: from h2 a[href="/owner/repo"]
    const repoMatch = chunk.match(
      /<h2[^>]*>.*?<a[^>]*href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"[^>]*>/s
    );
    if (!repoMatch) continue;
    const repo = repoMatch[1].trim();

    // Skip sponsor/ads
    if (
      repo.includes("sponsor") ||
      repo.includes("sponsors") ||
      !repo.includes("/")
    ) continue;

    // Description: <p class="col-9...">
    const descMatch = chunk.match(
      /<p class="col-9[^"]*"[^>]*>(.*?)<\/p>/s
    );
    const description = (descMatch && stripTags(descMatch[1]) || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    // Language: itemprop="programmingLanguage"
    const langMatch = chunk.match(
      /itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/i
    );
    const language = (langMatch && langMatch[1].trim()) || null;

    // Total stars: near href=".../stargazers"
    const starsMatch = chunk.match(
      /href="\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/stargazers"[^>]*>\s*\[?([0-9,]+)\]?/i
    );
    const stars = parseNumber(starsMatch && starsMatch[1] || null);

    // Stars today: "X stars today"
    const todayMatch = chunk.match(
      /([\d,]+)\s*stars today/i
    );
    const recent_stars = parseNumber(todayMatch && todayMatch[1] || null);

    // Only include if it looks like a real repo with stars data
    if (!stars && !recent_stars) continue;

    items.push({
      repo,
      description,
      language,
      stars,
      recent_stars,
      url: `https://github.com/${repo}`,
    });
  }

  return items;
}

async function main() {
  try {
    const html = await fetchHTML();
    const items = parseTrending(html);

    if (!items || items.length === 0) {
      console.error("Error: no repos parsed from GitHub Trending");
      process.exit(1);
    }

    const date = today();
    const out = {
      source: "github_trending",
      date,
      period: "daily",
      items,
    };

    const fs = await import("fs");
    const path = await import("path");
    const dataDir = path.default.resolve("data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const file = path.default.join(dataDir, `github_trending_${date}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 2), "utf-8");

    console.log(`OK: wrote ${file} with ${items.length} repos`);
  } catch (err) {
    console.error("Error in github_trending.mjs:", err.message || err);
    process.exit(1);
  }
}

main();
