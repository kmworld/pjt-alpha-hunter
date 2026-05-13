# Spec: Reddit Signals Script

File: scripts/reddit_signals.mjs

Requirements:
- Target subreddits (initial set):
  - r/futurology
  - r/technology
  - r/startups
  - r/opensource
  - r/cybersecurity
  - r/cryptocurrency
- For each:
  - Use: https://www.reddit.com/r/{sub}/top.json?t=day&limit=30
- Collect per post:
  - title, url, score, num_comments, subreddit

Output:
- data/reddit_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "reddit",
    "date": "YYYY-MM-DD",
    "subreddits": [
      {
        "name": "r/example",
        "posts": [
          { "title", "url", "score", "comments" }
        ]
      }
    ]
  }

Constraints:
- No npm deps.
- Add small delay (e.g., 300–500ms) between subreddits to be polite.
- On error, log and exit 1.
