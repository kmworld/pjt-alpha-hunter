# Spec: Job Signals Script

File: scripts/job_signals.mjs

Requirements:
- Use Node.js (mjs), Node 22+ built-in fetch only. No npm installs.
- Collect a sample of jobs from:
  - Wellfound (AngelList)
  - YC Work at a Startup
- Use keyword-based queries (AI, AI infra, agent, ZK, DePIN, WebGPU, edge AI, etc.)
- For each job:
  - title, company, tags (extracted keywords), location, url

Output:
- data/job_signals_<YYYY-MM-DD>.json
- Schema:
  {
    "source": "job_signals",
    "date": "YYYY-MM-DD",
    "jobs": [
      {
        "title": "...",
        "company": "...",
        "tags": ["AI", "infra"],
        "location": "Remote",
        "url": "https://..."
      }
    ]
  }

Constraints:
- No npm deps.
- If one platform fails, still succeed with the other.
- On total failure, log and exit 1.
