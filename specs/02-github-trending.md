# Spec: GitHub Trending Script

File: scripts/github_trending.mjs

Requirements:
- Fetch GitHub Trending (daily) page.
- Use OpenClaw web_fetch on:
  - https://github.com/trending?since=daily
- Parse HTML into list of repos:
  - repo (owner/repo)
  - description (short)
  - language
  - stars
  - recent_stars (if present)
  - url

Output:
- data/github_trending_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "github_trending",
    "date": "YYYY-MM-DD",
    "period": "daily",
    "items": [ { "repo", "description", "language", "stars", "recent_stars", "url" } ]
  }

Constraints:
- No npm deps.
- Use text extraction via OpenClaw web_fetch (markdown mode) then parse.
- If parse fails, log error and exit 1.
