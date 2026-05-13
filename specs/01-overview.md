# Spec: Alpha Hunter Signal Scripts Overview

Goal:
- Create 7 Node.js (mjs) scripts that collect raw signal data from key sources.
- Each script runs independently, writes JSON to data/.
- No UI, no frameworks—just reliable data collection.

Shared rules:
- Use only built-in Node modules + fetch (Node 22+).
- Use web_fetch / browser tool via OpenClaw where needed (via exec or tool calls).
- Each script must:
  - Log briefly to console (what it’s doing).
  - Write JSON to data/<source>_<YYYY-MM-DD>.json.
  - Exit 0 on success, 1 on failure.

Sources:
1. GitHub Trending
2. Hacker News
3. Reddit (selected subreddits)
4. X / Tech Twitter (limited, safe)
5. Research & ML (Hugging Face + ArXiv)
6. Product Hunt / BetaList / IndieHackers / YC
7. Job Signals (Wellfound / YC Work at a Startup)

Details per source in individual spec files.
