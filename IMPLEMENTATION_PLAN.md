# Alpha Hunter — Implementation Plan (Ralph Mode)

Goal:
- Improve data quality across all sources.
- Enrich deep context with alpha theses, risks, cross-source validation.
- Redesign Alpha Daily Report structure to be more analytical and forward-looking.
- Turn Alpha Hunter from a scraper into an alpha engine.

---

## Phase 0: Data Quality Assessment (Completed)

- [x] Inspected all `data/*_2026-05-13.json` files.
- [x] Identified critical gaps per source.
- [x] Documented in `data_assessment_2026-05-14.md`.

Key findings:
- alpha_deep_context signal_reason / alpha_thesis / risk are boilerplate.
- ArXiv pipeline fetches stale papers (2018–2024).
- Hugging Face likes all zero.
- GitHub stars always null.
- Reddit missing permalink and selftext_short.
- Job signals missing jd_summary and why_signal.
- Daily report is a listing, not analysis.

---

## Phase 1: Data Enrichment (Per-Source Required Fields)

### 1) github_trending.mjs (Completed)

- [x] Fix `stars` to capture total stars from GitHub API (`stargazers_count`); no longer null.
- [x] Add:
  - `topics`: up to 6 topics from GitHub API (fallback to derived from description).
  - `why_notable`: short, domain-aware rationale (AI/ML, infra, crypto, security, devtools, etc.).
  - `forks`: number of forks from GitHub API.
  - `owner_type`: "org" | "individual" via heuristic + owner.type.
- [x] Ensure `recent_stars` is stable and accurate (from HTML).
- [x] Output schema matches target:

  {
    "repo": "owner/repo",
    "description": "...",
    "language": "...",
    "stars": 123456,
    "recent_stars": 1500,
    "forks": 320,
    "topics": ["ai-agents", "llm"],
    "owner_type": "individual",
    "why_notable": "Extremely high star velocity; likely breakout tool",
    "url": "https://github.com/owner/repo"
  }

### 2) reddit_signals.mjs

- [x] Add:
  - `url` as Reddit post permalink (e.g., https://www.reddit.com/r/.../comments/...).
  - `selftext_short`: first 1,200 chars of selftext (for discussion/self-posts).
  - `why_hot`: short rationale based on domain (AI, crypto, security, startup, infra, OSS) plus brief summary.
- [x] Improve `hot_subreddits`:
  - Populated via popular/rising scans filtered by alpha-relevant keywords.
  - Includes `post_count` and `sample_titles`.
- [ ] Filter or score (next iteration):
  - Reduce noise from r/startups "I will not promote" posts.
  - Add `quality_hint`: "discussion" | "news-link" | "self-promo" | "spam-ish".
- [ ] Output schema (target):

  {
    "title": "...",
    "url": "https://external-article.com/...",
    "permalink": "https://www.reddit.com/r/.../comments/...",
    "selftext_short": "...",
    "score": 18746,
    "comments": 1082,
    "why_hot": "Major policy/tech shift; high community engagement",
    "quality_hint": "news-link"
  }

### 3) hn_signals.mjs (Completed)

- [x] Add:
  - `category_hint`: "ai-ml", "infra", "security", "crypto", "science", "career", "lifestyle", "other".
  - `why_hot`: short rationale (e.g., "HN-validated tool", "infrastructure debate", "AI safety concern").
- [x] Output schema (target) implemented:

  {
    "id": 123456,
    "title": "...",
    "url": "...",
    "score": 880,
    "comments": 1461,
    "category_hint": "ai-ml",
    "why_hot": "High engagement HN story; major product launch"
  }

### 4) job_signals.mjs (Completed)

- [x] Add:
  - `jd_summary`: 1–2 sentence summary (core responsibilities).
  - `extracted_skills`: list of key skills (e.g., ["Rust", "Kubernetes", "LLMs"]).
  - `why_signal`: why this job matters (e.g., "AI agent infra demand", "ZK engineer shortage", "edge AI growth").
  - `company_sector`: "ai-infra", "fintech", "healthtech", "crypto", "infra", "other".
- [x] Output schema (target) implemented.
- [x] Unified enrichment logic (single `enrichJob`), applied to YC + Wellfound.
- [x] Validated with 2026-05-14 run.

  {
    "title": "Machine Learning Engineer, Physical AI",
    "company": "Encord",
    "tags": ["AI", "machine learning"],
    "location": "San Francisco, CA, US",
    "salary": "$150K - $200K",
    "roleType": "Machine learning",
    "companyBatch": "W21",
    "jd_summary": "Build ML pipelines for physical AI systems...",
    "extracted_skills": ["PyTorch", "robotics", "RL"],
    "company_sector": "ai-infra",
    "why_signal": "Strong demand for ML engineers in physical AI; indicates growth in embodied AI",
    "url": "https://www.workatastartup.com/job/..."
  }

### 5) research_ml_signals.mjs (HF + ArXiv) (Completed)

- [x] Hugging Face:
  - [x] Switched to official HF API (reliable likes/downloads).
  - [x] Added `why_notable`, `sector_themes`, `downloads`.
- [x] ArXiv:
  - [x] Enforced last 14 days recency filter.
  - [x] Added `why_notable`, `sector_themes`.
- [x] Output schemas match target.
- [x] Validated with 2026-05-14 run (HF likes > 0, ArXiv dates recent).

### 6) product_launch_signals.mjs (Enrichment Completed) [2026-05-14]

- [x] Add:
  - `tags`: classify by domain (e.g., ["AI", "DevTools", "Marketing"]).
  - `why_notable`: short rationale.
  - `tech_domain`: "ai-agent", "devtools", "marketing", "infra", "consumer", "crypto", "other".
- [ ] Improve IndieHackers and YC sections:
  - IndieHackers: fetch real posts.
  - YC: scrape Work at a Startup highlights or YC Blog.
- [x] PH output schema (target) implemented:

  {
    "name": "Memoket Gem",
    "tagline": "An AI wearable that remembers your conversations all day",
    "votes": 263,
    "tags": ["AI", "Hardware", "Consumer"],
    "tech_domain": "ai-agent",
    "why_notable": "AI wearable with strong early traction",
    "url": "..."
  }

### 7) alpha_deep_context.mjs (Deep Context Upgrade) (Completed)

- [x] Replace boilerplate signal_reason with meaningful rationale.
- [x] Per candidate:
  - [x] `alpha_thesis`: 2–4 lines, 6–24 month horizon, sector/stack impact.
  - [x] `risk`: concrete risks (hype, regulation, tech, competition).
  - [x] `cross_source_links`: other sources that confirm/contradict.
  - [x] `sector_themes`: 2–4 themes per candidate.
- [x] Added:
  - [x] `sector_themes`: auto-generated from all signals.
  - [x] `contrarian_notes`: 1–2 challenging observations.
- [x] Output schema matches target.
- [x] Validated with 2026-05-14 run.

  "candidates": [
    {
      "id": 1,
      "name": "mattpocock/skills",
      "type": "project",
      "sources": ["github"],
      "summary": "...",
      "alpha_thesis": "Defines a new standard for agent skills; if adopted widely, becomes infra for AI workflows.",
      "risk": "Personal brand dependency; may not generalize beyond early adopters.",
      "cross_source_links": ["hn_signals", "reddit_r/startups"],
      "sector_themes": ["ai-agents", "devtools"]
    }
  ]

---

## Phase 2: New Alpha Daily Report Skeleton

Replace current listing-style report with an analyst-grade brief.

Structure:

1) Executive Summary
   - 3–6 bullet insights:
     - What’s moving today across all sources.
     - Focus on alpha-relevant patterns, not noise.

2) Sector Themes
   - 3–6 themes (e.g., "AI Agent Infra", "On-Device AI", "Physical AI", "Crypto Infra", "AI Safety / Alignment").
   - For each theme:
     - 2–4 bullets: what’s happening (GitHub, HN, Reddit, HF, jobs).
     - 1 bullet: why it matters in 6–24 months.

3) Alpha Hypotheses
   - 3–5 concrete hypotheses:
     - "If X continues, Y sector will see Z outcome by 2027."
   - Grounded in today’s signals, not speculation.
   - Each with:
     - Rationale (1–2 lines).
     - Confidence: High / Medium / Low.

4) Key Projects & Tools to Watch
   - 5–10 items:
     - Brief reason: why notable, what problem it solves.
     - Cross-source validation if present.

5) Job & Skill Signals
   - Emerging roles (3–5).
   - Emerging skills (3–5).
   - What they imply about where capital and talent are flowing.

6) Risk & Contrarian View
   - 2–4 bullets:
     - What might be overhyped.
     - Regulatory, technical, or market risks.
     - "If I had to bet against X, here’s why."

7) Near-Term vs Long-Term
   - Near-term (0–6 months): actionable signals.
   - Long-term (6–24 months): structural shifts to monitor.

8) Watchlist
   - 5–10 "watch closely" items (projects, companies, themes).
   - Short reason per item.

9) Cross-Source Overlap
   - Items confirmed by multiple sources:
     - Higher confidence, call out explicitly.

Constraints:
- Language: Korean, polite/analytical tone.
- No raw data dumps; interpret and synthesize.
- No filler; concise and decision-useful.

---

## Phase 3: Alpha Daily Report Redesign (Implementation)

- [ ] Update `alpha_daily_report.mjs` to:
  - Use new skeleton (Phase 2).
  - Generate:
    - Sector Themes
    - Alpha Hypotheses
    - Risk & Contrarian View
    - Near-Term vs Long-Term
    - Watchlist
  - Use enriched fields from Phase 1 and Phase 2.
- [ ] Ensure:
  - Output is Korean.
  - Tone is analyst-grade, not a news digest.
  - No boilerplate phrases.

---

## Phase 4: Patent Signals (New Data Layer)

- [ ] Design `patent_keywords.json`:
  - Sectors: AI/ML, Agents, Robotics, Web3, ZK, Bio+AI, Edge/On-Device, Crypto, Infra, Security.
  - Regions: US, KR, JP, TW.
- [ ] Implement `scripts/patent_signals.mjs`:
  - Use Google Patents + (optional) USPTO/KIPO/J-PlatPat/TIPO.
  - Output: `data/patents_{date}.json`.
- [ ] Integrate into:
  - `run_all_signals.mjs`
  - `alpha_deep_context.mjs` (sector_themes + candidates).

---

## Phase 5: Validation & Iteration

- [ ] Run full pipeline once with enriched fields.
- [ ] Review:
  - Deep context quality (signal_reason, alpha_thesis, risk).
  - Report quality (sector themes, hypotheses, contrarian view).
- [ ] Adjust prompts/scripts based on quality.
- [ ] Lock final cron prompt.
