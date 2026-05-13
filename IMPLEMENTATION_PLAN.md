# Implementation Plan — Alpha Hunter Signal Scripts

Goal:
Implement 7 independent data collection scripts (Node.js mjs).
Each script:
- Fetches from its source
- Writes structured JSON to data/<source>_<YYYY-MM-DD>.json
- Uses only built-in Node + fetch (Node 22+)
- No npm installs unless explicitly approved

Backpressure:
- For each script: node scripts/<file>.mjs must exit 0 and produce valid JSON.

## In Progress

(Start with first task below; move it here when active.)

## Completed

- scripts/hn_signals.mjs
  - Validated: node scripts/hn_signals.mjs exits 0
  - Output: data/hackernews_2026-05-13.json (top: 46, show_hn: 4)

## Backlog

- [ ] scripts/github_trending.mjs
  - Fetch GitHub Trending daily via web_fetch
  - Parse repos into data/github_trending_<YYYY-MM-DD>.json

- [x] scripts/reddit_signals.mjs
  - Use Reddit JSON endpoints for selected subreddits
  - Write data/reddit_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, 6 subreddits)

- [x] scripts/x_signals.mjs
  - Lightweight X/Twitter scraping via web_fetch for ~10 key accounts
  - Write data/x_twitter_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, 10 accounts, 94 tweets)

- [ ] scripts/research_ml_signals.mjs
  - Hugging Face trending + ArXiv API
  - Write data/research_ml_<YYYY-MM-DD>.json

- [ ] scripts/product_launch_signals.mjs
  - Product Hunt + IndieHackers + YC signals
  - Write data/product_launch_<YYYY-MM-DD>.json

- [ ] scripts/job_signals.mjs
  - Wellfound / YC Work at a Startup sample jobs
  - Write data/job_signals_<YYYY-MM-DD>.json
