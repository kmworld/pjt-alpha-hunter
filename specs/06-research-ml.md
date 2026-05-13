# Spec: Research & ML Ecosystem Script

File: scripts/research_ml_signals.mjs

Requirements:
- Hugging Face Trending:
  - Use web_fetch on:
    - https://huggingface.co/models?sort=trending
  - Parse trending models:
    - id (org/model), name/short desc, likes, tags, url
- ArXiv (cs.AI / cs.LG / cs.CR / cs.SE):
  - Use ArXiv API:
    - https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CR+OR+cat:cs.SE&max_results=30
  - Parse:
    - title, published, authors, abstract (short), link

Output:
- data/research_ml_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "research_ml",
    "date": "YYYY-MM-DD",
    "huggingface_trending": [
      { "id", "name", "likes", "tags", "url" }
    ],
    "arxiv_recent": [
      { "title", "date", "authors", "abstract_short", "url" }
    ]
  }

Constraints:
- No npm deps.
- If one source fails, still succeed with the other.
- On total failure, log and exit 1.
