# Spec: Product Hunt / BetaList / IndieHackers / YC Signals Script

File: scripts/product_launch_signals.mjs

Requirements:
- Product Hunt (primary):
  - Use web_fetch on https://www.producthunt.com/
  - Collect today’s top 20–30 products:
    - name, tagline, votes, tags, url
- IndieHackers / YC (secondary, limited):
  - Use web_fetch on:
    - https://www.indiehackers.com/
    - https://www.ycombinator.com/companies (or similar public page)
  - Collect 10–20 notable posts/companies:
    - title, short description, url

Output:
- data/product_launch_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "product_launch",
    "date": "YYYY-MM-DD",
    "product_hunt": [
      { "name", "tagline", "votes", "tags", "url" }
    ],
    "indiehackers": [
      { "title", "description_short", "url" }
    ],
    "yc": [
      { "title", "description_short", "url" }
    ]
  }

Constraints:
- No npm deps.
- If a source fails, still succeed with others.
- On total failure, log and exit 1.
