# Spec: Hacker News Script

File: scripts/hn_signals.mjs

Requirements:
- Use official HN Firebase API:
  - https://hacker-news.firebaseio.com/v0/topstories.json
- For each story id (limit 50):
  - fetch: https://hacker-news.firebaseio.com/v0/item/{id}.json
- Collect:
  - id, title, url, score, comments (descendants), time

Also:
- Filter "Show HN" stories from top/new (title includes "Show HN").

Output:
- data/hackernews_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "hackernews",
    "date": "YYYY-MM-DD",
    "sections": {
      "top": [ { "id", "title", "url", "score", "comments" } ],
      "show_hn": [ { "id", "title", "url", "score", "comments" } ]
    }
  }

Constraints:
- No npm deps.
- Sequential or limited-parallel fetch (avoid rate issues).
- On error, log and exit 1.
