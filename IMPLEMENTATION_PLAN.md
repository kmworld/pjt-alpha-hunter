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

- scripts/run_all_signals.mjs
  - Orchestrator: runs all 6 signal scripts sequentially, continues on failure, writes data/alpha_run_summary_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, summary JSON valid)

- scripts/alpha_daily_report.mjs
  - Reads today's JSON files from data/ and generates reports/daily/YYYY-MM-DD.md (deep analysis style, Korean)
  - Status: implemented, tested (exit 0, report non-empty)

- scripts/alpha_git_commit.mjs
  - Git add, commit ("daily: alpha hunter report YYYY-MM-DD"), and push origin main (best-effort)
  - Status: implemented, tested (exit 0, push successful)

- PIPELINE.md
  - Updated with "9. Daily Pipeline Integration" section (run_all → report → git commit; cron at 07:40 KST)

- IMPLEMENTATION_PLAN.md
  - Updated with all integration tasks marked completed

- [x] scripts/alpha_deep_context.mjs
  - New: unified deep-analysis layer
  - Reads all today's JSON files from data/ (github_trending, hackernews, reddit, research_ml, product_launch, job_signals)
  - Normalizes into single structured JSON: data/alpha_deep_context_<YYYY-MM-DD>.json
  - Includes:
    - sources metadata (counts, validity)
    - per-source signals (topByStarsToday, topByEngagement, hot_topics, trending_models, top_products, emerging_roles, etc.)
    - cross_source.overlap_candidates (multi-source validation)
    - dynamic candidates (5–15 items, scored, with alpha_thesis and risk)
  - Status: implemented, tested (exit 0, 12 candidates, valid JSON)

- [x] scripts/alpha_daily_report.mjs (Deep Context Mode)
  - Changed to read ONLY data/alpha_deep_context_<YYYY-MM-DD>.json
  - Generates Markdown report from unified JSON (not raw data dumps)
  - Sections: Executive Summary, GitHub, HN, Reddit, Research/ML, Product Launch, Job Signals, Cross-Source Overlap, Alpha Candidates
  - Status: implemented, tested (exit 0, 16k+ chars, insight-driven)

- [x] Full pipeline validation (Deep Context flow)
  - Steps executed:
    - node scripts/run_all_signals.mjs → 6/6 OK
    - node scripts/alpha_deep_context.mjs → valid JSON, 12 candidates
    - node scripts/alpha_daily_report.mjs → report generated from deep_context
    - node scripts/alpha_git_commit.mjs → commit + push OK
  - Confirmed:
    - alpha_deep_context_<YYYY-MM-DD>.json exists and is valid
    - reports/daily/YYYY-MM-DD.md uses deep_context, not raw data dump
    - Git commit and push succeed

## Backlog

- [x] scripts/github_trending.mjs
  - Fetch GitHub Trending daily via raw HTML parse (fixed parser)
  - Write data/github_trending_<YYYY-MM-DD>.json
  - Tested: 19 repos parsed, valid JSON

- [x] scripts/reddit_signals.mjs
  - Use Reddit JSON endpoints for selected subreddits
  - Write data/reddit_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, 6 subreddits)
  - Now includes hot_subreddits: scans r/all/top + /best.json, filters by tech/AI/crypto/startup keywords, outputs trending subreddits with post_count and sample_titles

- [x] scripts/x_signals.mjs
  - Lightweight X/Twitter scraping via web_fetch for ~10 key accounts
  - Write data/x_twitter_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, 10 accounts, 94 tweets)

- [x] scripts/research_ml_signals.mjs
  - Hugging Face trending + ArXiv API
  - Write data/research_ml_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, HF 29, ArXiv 30)

- [x] scripts/product_launch_signals.mjs
  - Product Hunt (403 due to Cloudflare, returns empty) + IndieHackers + YC signals
  - Write data/product_launch_<YYYY-MM-DD>.json
  - Note: Product Hunt requires browser-based scraping; to be handled via separate pipeline later

- [x] scripts/job_signals.mjs
  - YC Work at a Startup (primary); Wellfound as fallback (403, skipped)
  - Write data/job_signals_<YYYY-MM-DD>.json
  - Status: implemented, tested (exit 0, valid JSON, 30 jobs)
