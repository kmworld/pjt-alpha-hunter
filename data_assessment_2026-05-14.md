# Alpha Hunter — Data Quality Assessment (2026-05-14)

Based on inspection of all `data/*_2026-05-13.json` files, plus `alpha_deep_context_2026-05-13.json` and `alpha_daily_report.mjs`.

Goal: Identify what's missing, too shallow, or structurally weak per source, and define concrete improvements.

---

## 1. github_trending_2026-05-13.json

### Current fields (per item)
- repo, description, language, stars (null), recent_stars, url

### What's good
- recent_stars present (strong signal).
- 19 items, solid coverage for daily trending.

### What's missing / weak
- **stars is always null** → useless. Must fix scraper to capture total stars.
- **No topics / subjects** → cannot classify by sector (AI, infra, crypto, security, etc.).
- **No why_notable** → relies entirely on downstream LLM to guess significance.
- **No forks / contributors / last_updated** → missing ecosystem health signals.
- **No owner type** (individual vs org vs company) → important for alpha filtering.

### Priority: HIGH
Total stars + topics are essential for downstream analysis.

---

## 2. hackernews_2026-05-13.json

### Current fields (per item)
- id, title, url, score, comments
- Sections: top, show_hn

### What's good
- 48 top stories + 2 Show HN → excellent volume.
- score + comments are key engagement metrics.

### What's missing / weak
- **No why_hot / category_hint** → downstream has to infer "why is this hot?" and "what sector?" for every item.
- **No comment_sample** → a short sample of top comments (1–3 lines) would dramatically improve signal quality (sentiment, expert opinion).
- **No domain filter** → includes lifestyle/off-topic content (e.g., Kraftwerk, jelly on wall) that adds noise.
- **No distinction between "news" vs "build" vs "research"** → hard to separate product signals from general discussion.

### Priority: MEDIUM
Adding category_hint and why_hot will reduce noise and improve downstream alpha candidates.

---

## 3. reddit_2026-05-13.json

### Current fields (per post)
- title, url, score, comments
- Grouped by subreddit.

### What's good
- 128 posts across 6 subreddits: r/futurology, r/technology, r/startups, r/opensource, r/cybersecurity, r/cryptocurrency.
- Strong volume and engagement data.

### What's missing / weak
- **No permalink URL** → current url is often external article, not the Reddit thread. Hard to revisit discussion.
- **No selftext_short** → can't tell if post is discussion, news link, or self-post.
- **No why_hot** → no rationale for why a post is hot (community reaction, urgency, novelty).
- **No author_flair / award_count** → helps distinguish expert vs casual posts.
- **hot_subreddits is empty array** → not computed.
- **r/startups noise** → mostly "I will not promote" posts; low alpha value.

### Priority: HIGH
Permalink + selftext_short are critical for any serious discussion analysis.
Filtering noisy subreddits or adding quality scoring is needed.

---

## 4. research_ml_2026-05-13.json

### Current fields

#### Hugging Face Trending
- id, name, likes (always 0), tags, url

#### ArXiv Recent
- title, date, authors, abstract_short, url

### What's good
- HF trending: 29 models, good tag coverage (text-to-image, image-to-video, etc.).
- ArXiv: 30 papers collected.

### What's missing / weak

#### Hugging Face
- **likes all zero** → scraper is not capturing likes. Critical metric broken.
- **No why_notable** → every model listed without explanation.
- **No sector_themes** → e.g., "multimodal", "on-device AI", "TTS", "video gen" not grouped.
- **No download_count / last_updated** → missing traction signals.

#### ArXiv
- **Mostly old papers (2018–2024)** → not "recent" in a meaningful sense. Pipeline is fetching stale or irrelevant results.
- **No why_notable** → generic inclusion without rationale.
- **No sector_themes** → no mapping to AI safety, code LLMs, agents, etc.

### Priority: CRITICAL
- ArXiv pipeline must target truly recent papers (last 7–14 days).
- HF likes must be fixed; add why_notable and sector_themes.

---

## 5. product_launch_2026-05-13.json

### Current fields (Product Hunt)
- name, tagline, votes, tags (empty), url

### What's good
- 30 products, strong coverage.
- tagline is useful.

### What's missing / weak
- **tags always empty** → cannot classify by domain (AI, devtools, marketing, etc.).
- **No why_notable** → no rationale for selection.
- **No maker / company info** → can't track who's building what.
- **indiehackers has only a single placeholder entry** → "In Case You Missed It" with empty description.
- **yc is empty** → no YC data collected.

### Priority: MEDIUM
Tags + why_notable are essential for alpha filtering.

---

## 6. job_signals_2026-05-13.json

### Current fields (per job)
- title, company, tags, location, salary, roleType, companyBatch, url

### What's good
- 30 jobs, salary ranges present, batch info included.
- Tags capture some key skills (AI, agent, ML, backend).

### What's missing / weak
- **No jd_summary** → no summary of what the job actually requires.
- **No extracted_skills** → tags exist but are shallow; no structured skill list.
- **No why_signal** → no explanation of why this job is a signal.
- **No company_domain / sector** → can't map to AI infra, fintech, healthtech, etc.
- **No growth_signal** → can't distinguish "growing startup" vs "stable company".

### Priority: HIGH
jd_summary + why_signal are critical for using jobs as leading indicators.

---

## 7. alpha_deep_context_2026-05-13.json

### What's good
- Cross-source integration exists.
- 12 alpha candidates generated.
- Emerging stacks, emerging roles, overlap candidates included.

### What's missing / weak

#### Signal reasons are generic
- GitHub: "Strong GitHub momentum; early-stage project with real traction." (repeated for almost every candidate)
- HN: "High engagement HN story; broad tech interest." (same boilerplate)
- Research: "Trending on HF; early traction worth watching." (useless)
- Jobs: "Multiple postings; strong demand signal." (boilerplate)

#### Alpha thesis is shallow
- All candidates use same pattern: "Strong GitHub momentum; early-stage project with real traction."
- No sector-specific hypotheses.
- No "why this matters in 12–24 months" reasoning.

#### Risk is boilerplate
- "May be short-lived hype; verify sustained growth." → same for every candidate.

#### Cross-source overlap too thin
- Only 1 overlap candidate (Googlebook).
- No deeper mapping between Reddit discussions + GitHub projects + HF models.

### Priority: CRITICAL
This is the core intelligence layer. If signal_reason, alpha_thesis, and risk are boilerplate, the whole system is just a news aggregator, not an alpha engine.

---

## 8. alpha_daily_report.mjs (Report Structure)

### What's good
- Uses deep_context as input.
- Produces structured Markdown with 9 sections.
- Covers all major sources.

### What's missing / weak

#### Structure is listing, not analysis
- Sections simply enumerate items with bullet points.
- No synthesis, no narrative, no "so what?"
- Reads like a digest, not an analyst brief.

#### Missing analytical layers
- **No sector_themes section** → no clustering by AI agents, infra, crypto, bio+AI, etc.
- **No Alpha Hypothesis** → no "why this trend matters and where it leads".
- **No Risk & Contrarian View** → no pushback on hype.
- **No Near-term vs Long-term separation** → no time horizon for signals.
- **No "Watchlist" or "Act Now" tiering** → no actionability.

#### Language
- Mix of Korean and English, inconsistent.
- Not tailored for an analyst-grade audience.

### Priority: HIGH
Report must evolve from "data dump" to "strategic brief".

---

## Summary: Critical Gaps (Ordered by Impact)

1. **alpha_deep_context signal_reason / alpha_thesis / risk are boilerplate** → system output is generic.
2. **ArXiv pipeline fetches stale papers** → research layer is not useful.
3. **Hugging Face likes all zero** → broken metric.
4. **GitHub stars always null** → missing total stars.
5. **Reddit missing permalink, selftext_short** → can't analyze discussions.
6. **Job signals missing jd_summary, why_signal** → can't use as leading indicators.
7. **Daily report is a listing, not analysis** → no sector themes, no hypotheses, no risk.

These are the foundations. Fixing these will transform Alpha Hunter from a scraper into an actual alpha engine.
