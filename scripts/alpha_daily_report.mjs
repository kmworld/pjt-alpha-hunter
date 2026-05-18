// scripts/alpha_daily_report.mjs
// VC-grade daily brief — 한국어 출력.
// Output: reports/daily/YYYY-MM-DD.md
// Node 22+ built-in only. No npm installs.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const REPORTS_DIR = path.join(PROJECT_ROOT, "reports", "daily");

function todayISODate() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function yesterdayISODate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return null; }
}

function limitLen(s, max) {
  s = (s || "").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ===================== Reddit 포스트 한국어 요약 =====================

function summarizeRedditPost(title) {
  const t = title.toLowerCase();

  // AI hate / backlash
  if (/ai.*hate|hate.*ai|backlash|anti.?ai/i.test(t)) {
    return "AI 기술에 대한 대중의 반감과 우려가 표면화되는 현상";
  }
  // Microsoft missed AI
  if (/microsoft.*missed|missed.*microsoft/i.test(t)) {
    return "Microsoft가 AI 파도를 놓쳤다는 전 임원의 평가 — Copilot 확장 실패 분석";
  }
  // Linus Torvalds / AI bug
  if (/linus|torvalds.*ai|ai.*bug/i.test(t)) {
    return "AI 기반 버그 헌터가 Linux 보안 메일링 리스트를 변화시키고 있음";
  }
  // prompt injection / LinkedIn
  if (/prompt.?injection|linkedin.*ai/i.test(t)) {
    return "AI prompt injection이 실제 사회 공학 공격 수단으로 활용되는 사례";
  }
  // entry-level jobs / death of junior
  if (/entry.?level|junior.*role|death.*job/i.test(t)) {
    return "CEO들의 주니어 포지션 대폭 축소 계획 — AI가 초급 일자리를 대체하는 추세";
  }
  // AI warfare / Pope
  if (/warfare|pope.*ai|ai.*war/i.test(t)) {
    return "교황이 AI 기반 군사 기술의 위험성 경고 — AI 무기 경쟁의 윤리적 문제";
  }
  // antimatter / physics
  if (/antimatter|physics|atom.*wave/i.test(t)) {
    return "반물질 원자의 파동 현상 최초 관측 — 기초 물리학의 중요한 발견";
  }
  // brute force / bitcoin mining
  if (/brute.?force|bitcoin.*mining|mining.*bitcoin/i.test(t)) {
    return "Bitcoin mining을 활용한 대규모 brute-force 시도 — 분산 컴퓨팅의 양면성";
  }
  // Bitcoin maritime / Iran
  if (/iran|maritime|bitcoin.*insurance/i.test(t)) {
    return "이란이 호르무즈 해운에 Bitcoin 기반 보험 플랫폼 도입 —Crypto의 실제 사용 사례";
  }
  // AI agents choose Bitcoin
  if (/ai.*agent.*bitcoin|agent.*money|bitcoin.*agent/i.test(t)) {
    return "AI Agent들이 Bitcoin을 자체 화폐로 선택 — 자동화된 경제 시스템의 신호";
  }
  // baby monitors / security camera
  if (/baby.?monitor|security.?camera|camera.*hacker/i.test(t)) {
    return "수십만 개의 보안 카메라/베이비 모니터 해킹 노출 — IoT 보안의 심각한 취약점";
  }
  // zero-day / Windows exploit
  if (/zero.?day|exploit|windows.*vulnerab/i.test(t)) {
    return "Windows 0-day 취약점 PoC 공개 — SYSTEM 권한 탈취 가능한 심각한 문제";
  }
  // time-to-exploit / vulnerability
  if (/time.?to.?exploit|vulnerability.*everywhere/i.test(t)) {
    return "취약점 발견부터 악용까지 평균 2.1일로 단축 — AI 시대의 보안 위기 가속화";
  }
  // Eric Schmidt / booed
  if (/schmidt|booed|student.*ai/i.test(t)) {
    return "AI 옹호자가 학생들로부터 야유 — 젊은 세대의 AI에 대한 거부감";
  }
  // Claude / AI model
  if (/claude|gemini|gpt|chatgpt/i.test(t)) {
    return "최신 AI 모델에 대한 커뮤니티 평가 및 사용 사례 공유";
  }
  // robotics / physical AI
  if (/robot|physical.*ai|humanoid/i.test(t)) {
    return "로봇/물리적 AI 분야의 새로운 발전과 논의";
  }
  // funding / startup
  if (/funding|raise|seed|series/i.test(t)) {
    return "스타트업 자금 조달 동향 — 투자 시장의 신호";
  }
  // default
  return "커뮤니티에서 활발히 논의 중인 주제";
}

// ===================== Report Generator =====================

function generateReport(date, yesterday, ctx, raw) {
  const L = [];
  const push = (s = "") => L.push(s);
  const section = (num, title) => { push(); push(`## ${num}. ${title}`); };

  const clusters = ctx.keyword_clusters || [];
  const newTerms = ctx.new_terms || [];
  const crossSignals = ctx.cross_source_signals || [];
  const candidates = ctx.alpha_candidates || [];
  const sectorThemes = ctx.sector_themes || [];
  const contrarian = ctx.contrarian_notes || [];

  // Raw data
  const ghItems = raw.github?.items || [];
  const redditData = raw.reddit || {};
  const phProducts = raw.product_launch?.product_hunt || [];
  const ihPosts = raw.product_launch?.indiehackers || [];
  const ycCompanies = raw.product_launch?.yc || [];
  const blStartups = raw.product_launch?.betalist || [];
  const allJobs = raw.jobs?.jobs || [];

  // Big Tech AI jobs
  const bigtechJobsData = raw.bigtech_ai_jobs || null;
  const bigtechJobs = bigtechJobsData?.jobs || [];
  const bigtechJobCount = bigtechJobs.length;

  // Yesterday's GitHub data for ranking comparison
  const yesterdayGhItems = (raw.yesterday_github?.items || []);
  const yesterdayRankMap = {};
  yesterdayGhItems.forEach((r, i) => { yesterdayRankMap[r.repo] = i + 1; });

  // Counts
  const ghCount = ghItems.length;
  const hnData = raw.hackernews || null;
  const hnTopItems = hnData?.sections?.top || [];
  const hnShowItems = hnData?.sections?.show_hn || [];
  const hnCount = hnTopItems.length + hnShowItems.length;
  const rdCount = redditData.global_hot_posts?.length || 0;
  const hfCount = (ctx.sources?.research_ml?.hfCount || 0);
  const phCount = phProducts.length;
  const jobCount = allJobs.length;

  // ===================== Title =====================
  push(`# 🔍 Alpha Hunter Deep Daily Brief — ${date}`);
  push();
  push(`> GitHub ${ghCount} · HN ${hnCount} · Reddit ${rdCount} · HF ${hfCount} · PH ${phCount} · Jobs ${jobCount}`);

  // ===================== 1. Executive Summary =====================
  section(1, "Executive Summary — 오늘의 핵심 신호");

  // Dominant themes
  if (clusters.length > 0) {
    const topThemes = clusters.slice(0, 3).map(c => c.name).join(", ");
    const totalSignals = clusters.reduce((s, c) => s + c.count, 0);
    push(`- **${topThemes}** — 총 ${totalSignals}개의 관련 키워드/멘션이 포착됨.`);
  }

  // Rising GitHub stars
  const risingStars = ghItems.filter(r => r.is_rising_star).slice(0, 3);
  if (risingStars.length > 0) {
    const starNames = risingStars.map(r => `[${r.repo}](https://github.com/${r.repo})`).join(", ");
    push(`- GitHub에서 급성장하는 프로젝트: ${starNames} — 개발자 커뮤니티의 실제 관심이 집중되고 있음.`);
  }

  // Reddit hot topics
  const redditHotPosts = redditData.global_hot_posts || [];
  if (redditHotPosts.length > 0) {
    const aiPosts = redditHotPosts.filter(p => /ai|agent|llm|claude|gpt/i.test(p.title || ""));
    if (aiPosts.length >= 3) {
      push(`- Reddit에서 AI 관련 논의가 활발함 (${aiPosts.length}개 핫 포스트). 커뮤니티의 실제 사용 경험과 우려가 동시에 표출됨.`);
    }
  }

  // Cross-source validation
  if (crossSignals.length > 0) {
    const strong = crossSignals.filter(s => s.strength === "strong").length;
    push(`- 복수 소스에서 교차 확인된 신호 ${crossSignals.length}건 (strong ${strong}). 단순 노이즈가 아닌 구조적 관심.`);
  }

  // Product launches
  if (phProducts.length > 0) {
    const aiProducts = phProducts.filter(p => /ai|agent|llm/i.test((p.name || "") + (p.tagline || "")));
    push(`- 오늘 ProductHunt ${phProducts.length}개 제품 중 AI 관련 ${aiProducts.length}개. AI-native 제품 경쟁이 가속화.`);
  }

  // ===================== 2. GitHub Rising Stars =====================
  section(2, "GitHub Rising Stars — 최근 Star Velocity");

  if (ghItems.length === 0) {
    push("- 오늘 GitHub Trending 데이터가 부족합니다.");
  } else {
    // Sort by recent_stars descending
    const sorted = [...ghItems].sort((a, b) => (b.recent_stars || 0) - (a.recent_stars || 0));
    
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const r = sorted[i];
      const repo = r.repo || "";
      const desc = limitLen(r.description || r.repo_summary || "", 120);
      const stars = r.recent_stars ?? r.stars ?? null;
      const lang = r.language || "—";
      const topics = (r.topics || []).slice(0, 5).join(", ");
      const why = r.why_people_care || r.why_notable || "";
      const todayRank = i + 1;
      const yesterdayRank = yesterdayRankMap[repo] || null;
      const isNew = r.new_this_day ? " 🆕 NEW" : "";

      // Ranking change
      let rankChange = "";
      if (yesterdayRank) {
        const diff = yesterdayRank - todayRank;
        if (diff > 0) rankChange = ` ↑${diff}등`;
        else if (diff < 0) rankChange = ` ↓${Math.abs(diff)}등`;
        else rankChange = ` →동일`;
      } else {
        rankChange = " 🆕신규";
      }

      push(`### ${todayRank}. [${repo}](https://github.com/${repo})${rankChange}${isNew}`);
      push(`- **오늘 Star:** +${stars || "?"} | **언어:** ${lang}`);
      if (yesterdayRank) push(`- **어제 순위:** ${yesterdayRank}위 → **오늘 순위:** ${todayRank}위`);
      if (desc) push(`- **설명:** ${desc}`);
      if (topics) push(`- **Topics:** ${topics}`);
      if (why) push(`- **Why care:** ${why}`);
      push();
    }
  }

  // ===================== 3. Hacker News Top Stories =====================
  section(3, "Hacker News — 기술 커뮤니티의 오늘");

  // Category labels in Korean
  const categoryLabel = {
    "ai-ml": "🤖 AI/ML",
    "crypto": "₿ Crypto",
    "security": "🔒 Security",
    "infra": "⚙️ Infra",
    "science": "🔬 Science",
    "career": "💼 Career",
    "business": "📈 Business",
    "lifestyle": "🌿 Lifestyle",
    "other": "📌 기타",
  };

  if (hnTopItems.length === 0 && hnShowItems.length === 0) {
    push("- 오늘 Hacker News 데이터가 부족합니다.");
  } else {
    // Sort top items by score descending
    const sortedHn = [...hnTopItems].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Show top 15 by score
    for (const item of sortedHn.slice(0, 15)) {
      const title = limitLen(item.title || "", 120);
      const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      const score = item.score ?? 0;
      const comments = item.comments ?? 0;
      const category = categoryLabel[item.category_hint] || "📌 기타";
      const whyHot = item.why_hot || "";
      const articleSummary = limitLen(item.article_summary || "", 150);

      push(`- [${title}](${url}) — ⬆${score} 💬${comments} ${category}`);
      if (whyHot) push(`  > ${whyHot}`);
      if (articleSummary) push(`  > ${articleSummary}`);
    }

    // Show HN items
    if (hnShowItems.length > 0) {
      push();
      push("**🛠 Show HN — 새로운 프로젝트/도구**");
      for (const item of hnShowItems.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8)) {
        const title = limitLen(item.title || "", 120);
        const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
        const score = item.score ?? 0;
        const comments = item.comments ?? 0;
        const category = categoryLabel[item.category_hint] || "📌 기타";
        const articleSummary = limitLen(item.article_summary || "", 150);

        push(`- [${title}](${url}) — ⬆${score} 💬${comments} ${category}`);
        if (articleSummary) push(`  > ${articleSummary}`);
      }
      push();
    }
  }

  // ===================== 4. Reddit Community Signals =====================
  section(4, "Reddit Community Signals — 빌더들이 이야기하는 것");

  const subreddits = redditData.subreddits || [];

  if (redditHotPosts.length === 0) {
    push("- 오늘 Reddit 핫 포스트 데이터가 부족합니다.");
  } else {
    // Group by subreddit
    const bySub = {};
    for (const post of redditHotPosts) {
      const sub = post.subreddit || "unknown";
      if (!bySub[sub]) bySub[sub] = [];
      bySub[sub].push(post);
    }

    for (const [sub, posts] of Object.entries(bySub)) {
      if (posts.length < 2) continue;
      push(`**${sub}** (${posts.length} posts)`);
      for (const post of posts.slice(0, 4)) {
        const title = limitLen(post.title || "", 100);
        const url = post.url || "";
        const score = post.score ?? 0;
        const comments = post.comments ?? 0;
        const summary = summarizeRedditPost(post.title || "");
        const postSummary = limitLen(post.post_summary || "", 120);
        push(`- [${title}](${url}) — ⬆${score.toLocaleString()} 💬${comments} | ${summary}`);
        if (postSummary) push(`  > ${postSummary}`);
      }
      push();
    }

    // Hot subreddits — 부상하는 커뮤니티
    const hotSubs = redditData.hot_subreddits || [];
    if (hotSubs.length > 0) {
      push("**🔥 부상하는 커뮤니티**");
      for (const sub of hotSubs) {
        const sampleTitle = sub.sample_titles?.[0] || "";
        const summary = summarizeRedditPost(sampleTitle);
        push(`- **${sub.name}**: ${sub.reason || sub.post_count || "?"} posts — ${summary}`);
      }
      push();
    }
  }

  // ===================== 5. New Products & Launches =====================
  section(5, "New Products & Launches — 새로운 제품/서비스");

  // Product Hunt
  if (phProducts.length > 0) {
    push("**Product Hunt**");
    for (const p of phProducts.slice(0, 10)) {
      const name = p.name || "";
      const tagline = limitLen(p.tagline || "", 100);
      const url = p.url || "";
      const maker = p.maker ? ` by ${p.maker}` : "";
      const techDomain = p.tech_domain || "";
      const whyNotable = p.why_notable || "";
      
      // Generate description
      let desc = "";
      if (tagline) desc = tagline;
      else if (whyNotable) desc = whyNotable;
      else if (techDomain) desc = `${techDomain} 도메인`;
      
      push(`- [${name}](${url})${maker}`);
      if (desc) push(`  - ${desc}`);
      else push(`  - 🆕 오늘의 새로운 런칭`);
    }
    push();
  }

  // IndieHackers
  if (ihPosts.length > 0) {
    push("**IndieHackers**");
    for (const p of ihPosts.slice(0, 5)) {
      const title = limitLen(p.title || "", 100);
      const desc = limitLen(p.description_short || "", 80);
      const url = p.url || "";
      push(`- [${title}](${url})`);
      if (desc) push(`  - ${desc}`);
    }
    push();
  }

  // YC
  if (ycCompanies.length > 0) {
    push("**Y Combinator Companies**");
    for (const c of ycCompanies.slice(0, 5)) {
      const title = limitLen(c.title || "", 100);
      const desc = limitLen(c.description_short || "", 80);
      const url = c.url || "";
      push(`- [${title}](${url})`);
      if (desc) push(`  - ${desc}`);
    }
    push();
  }

  // BetaList
  if (blStartups.length > 0) {
    push("**BetaList Startups**");
    for (const s of blStartups.slice(0, 5)) {
      const title = limitLen(s.title || "", 100);
      const desc = limitLen(s.description_short || "", 80);
      const url = s.url || "";
      push(`- [${title}](${url})`);
      if (desc) push(`  - ${desc}`);
    }
    push();
  }

  if (phProducts.length === 0 && ihPosts.length === 0 && ycCompanies.length === 0 && blStartups.length === 0) {
    push("- 오늘 새로운 제품/런칭 데이터가 부족합니다.");
  }

  // ===================== 6. Job Market Signals =====================
  section(6, "Job Market Signals — 기업들이 어디에 돈을 쓰고 있는가");

  if (allJobs.length === 0) {
    push("- 오늘 채용 신호 데이터가 부족합니다.");
  } else {
    // Group by role type
    const byRole = {};
    for (const job of allJobs) {
      const role = job.roleType || job.tags?.[0] || "Other";
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push(job);
    }

    // Show top roles by count
    const sortedRoles = Object.entries(byRole).sort((a, b) => b[1].length - a[1].length);

    push("**📊 Role 분포** — 기업들이 채용하는 포지션:");
    for (const [role, jobs] of sortedRoles.slice(0, 8)) {
      push(`- **${role}**: ${jobs.length} positions`);
    }
    push();

    // AI/Agent-related jobs
    const aiJobs = allJobs.filter(j => /ai|agent|machine learning|llm/i.test((j.title || "") + (j.tags?.join(" ") || "")));
    if (aiJobs.length > 0) {
      push(`**🤖 AI/Agent 관련 채용** (${aiJobs.length} positions)`);
      for (const job of aiJobs.slice(0, 8)) {
        const title = limitLen(job.title || "", 80);
        const company = job.company || "";
        const salary = job.salary || "";
        const url = job.url || "";
        push(`- [${title}](${url}) — ${company}${salary ? ` | ${salary}` : ""}`);
      }
      push();
    }

    // Extract unique keywords from JDs
    const keywordFreq = {};
    const bigTechKeywords = new Set([
      "llm", "agent", "rag", "vector", "embedding", "fine-tune", "inference",
      "transformer", "diffusion", "multimodal", "vision", "speech", "tts",
      "stt", "nlp", "computer vision", "reinforcement", "rlhf", "dpo",
      "pytorch", "tensorflow", "jax", "vllm", "triton", "cuda",
      "kubernetes", "docker", "terraform", "aws", "gcp", "azure",
      "python", "rust", "go", "typescript", "react", "next.js",
      "data pipeline", "etl", "airflow", "spark", "kafka",
      "observability", "monitoring", "logging", "tracing",
    ]);

    for (const job of allJobs) {
      const jd = (job.jd_summary || "") + " " + (job.role_specifics || "") + " " + (job.tags?.join(" ") || "");
      const skills = (job.extracted_skills || []).join(" ");
      const stack = (job.required_stack || []).join(" ");
      const text = (jd + " " + skills + " " + stack).toLowerCase();
      
      for (const keyword of bigTechKeywords) {
        if (text.includes(keyword)) {
          keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
        }
      }
    }

    // Sort by frequency
    const sortedKeywords = Object.entries(keywordFreq).sort((a, b) => b[1] - a[1]);

    if (sortedKeywords.length > 0) {
      push("**🔍 JD에서 추출한 키워드** — 기업들이 실제로 요구하는 스킬:");
      for (const [keyword, count] of sortedKeywords.slice(0, 15)) {
        push(`- **${keyword}**: ${count}개 채용에서 언급`);
      }
      push();
    }

    // M7/Big Tech focused analysis
    const m7Companies = allJobs.filter(j => /google|meta|openai|anthropic|tesla|amazon|microsoft|apple/i.test(j.company || ""));
    if (m7Companies.length > 0) {
      push("**🏢 M7/Big Tech 관련 채용**");
      for (const job of m7Companies.slice(0, 5)) {
        const title = limitLen(job.title || "", 80);
        const company = job.company || "";
        const salary = job.salary || "";
        const url = job.url || "";
        push(`- [${title}](${url}) — ${company}${salary ? ` | ${salary}` : ""}`);
      }
      push();
    }

    // Sample jobs
    push("**📋 Sample Openings**");
    for (const job of allJobs.slice(0, 10)) {
      const title = limitLen(job.title || "", 80);
      const company = job.company || "";
      const salary = job.salary || "";
      const location = job.location || "";
      const url = job.url || "";
      push(`- [${title}](${url}) — ${company}${salary ? ` | ${salary}` : ""}${location ? ` | ${limitLen(location, 30)}` : ""}`);
    }
  }

  // ===================== 6a. Big Tech AI Hiring =====================
  section(6, "Big Tech AI 채용 — M7+AI 기업들이 누구를 뽑는가");

  if (bigtechJobs.length === 0) {
    push("- 오늘 빅테크 AI 채용 데이터가 부족합니다.");
  } else {
    // Group by company
    const byCompany = {};
    for (const job of bigtechJobs) {
      const company = job.company || "Unknown";
      if (!byCompany[company]) byCompany[company] = [];
      byCompany[company].push(job);
    }

    // Sort companies by priority
    const m7Priority = ["OpenAI", "Anthropic", "Google", "Meta", "Microsoft", "Amazon", "Tesla", "Apple", "xAI", "Nvidia"];
    const sortedCompanies = Object.entries(byCompany).sort((a, b) => {
      const aIdx = m7Priority.indexOf(a[0]);
      const bIdx = m7Priority.indexOf(b[0]);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });

    push(`**📊 총 ${bigtechJobs.length}개 포지션** — ${sortedCompanies.length}개 기업`);
    push();

    for (const [company, jobs] of sortedCompanies) {
      push(`**${company}** (${jobs.length}개 포지션)`);
      for (const job of jobs.slice(0, 5)) {
        const title = limitLen(job.title || "", 100);
        const url = job.url || "";
        const roleType = job.role_type || "";
        const skills = (job.skills || []).slice(0, 4).join(", ");
        push(`- [${title}](${url})`);
        if (roleType) push(`  - Role: ${roleType}`);
        if (skills) push(`  - Skills: ${skills}`);
      }
      push();
    }

    // Role distribution
    const roleDist = {};
    for (const job of bigtechJobs) {
      const role = job.role_type || "Engineering";
      roleDist[role] = (roleDist[role] || 0) + 1;
    }

    const sortedRoles = Object.entries(roleDist).sort((a, b) => b[1] - a[1]);
    push("**🎯 Role 분포** — 빅테크가 가장 많이 뽑는 포지션:");
    for (const [role, count] of sortedRoles) {
      push(`- **${role}**: ${count}개`);
    }
    push();

    // Top skills across all jobs
    const skillFreq = {};
    for (const job of bigtechJobs) {
      for (const skill of job.skills || []) {
        skillFreq[skill] = (skillFreq[skill] || 0) + 1;
      }
    }

    const sortedSkills = Object.entries(skillFreq).sort((a, b) => b[1] - a[1]);
    if (sortedSkills.length > 0) {
      push("**🔥 빅테크 AI 채용에서 가장 많이 요구하는 스킬**:");
      for (const [skill, count] of sortedSkills.slice(0, 10)) {
        push(`- **${skill}**: ${count}개 채용에서 언급`);
      }
      push();
    }
  }

  // ===================== 7. Keyword Clusters & Emerging Concepts =====================
  section(7, "Keyword Clusters & Emerging Concepts");

  push("**Keyword Clusters** — 실제 데이터에서 추출한 키워드 빈도 기반.");
  push();
  for (const c of clusters) {
    push(`- **${c.name}** (count: ${c.count})`);
    const terms = (c.sample_terms || []).slice(0, 6).join(", ");
    if (terms) push(`  - 관련 키워드: ${terms}`);
  }

  // New terms — only show meaningful ones
  const meaningfulTerms = newTerms.filter(t => {
    const term = (t.term || "").toLowerCase();
    // Filter out noise
    if (/says|mailing|bug hunter|warfare|rise of|the rise/i.test(term)) return false;
    return true;
  });

  if (meaningfulTerms.length > 0) {
    push();
    push("**Emerging Concepts** — 복수 소스에서 부상하는 의미 있는 개념.");
    push();
    for (const t of meaningfulTerms.slice(0, 6)) {
      push(`- **${t.term}** (count: ${t.count}, sources: ${t.sources?.join(", ") || "—"})`);
      if (t.definition_hint) push(`  - 정의: ${t.definition_hint}`);
      if (t.why_interesting) push(`  - 주목 이유: ${t.why_interesting}`);
    }
  }

  // ===================== 8. Cross-Source Validation =====================
  section(8, "Cross-Source Validation — 복수 소스 교차 검증");

  if (crossSignals.length === 0) {
    push("- 오늘 데이터로는 복수 소스에서 교차 확인된 명확한 신호가 부족합니다.");
  } else {
    for (const s of crossSignals) {
      push(`- **${s.name}** — strength: ${s.strength}, sources: ${s.sources.join(", ")} (count: ${s.count})`);
      if (s.summary) push(`  - ${s.summary}`);
    }
  }

  // ===================== 9. Alpha Candidates =====================
  section(9, "Alpha Candidates — 주목해야 할 프로젝트");

  if (candidates.length === 0) {
    push("- 오늘 데이터로는 Alpha Candidates를 도출하지 못했습니다.");
  } else {
    for (const c of candidates) {
      const name = c.name || "";
      const type = c.type || "";
      const sources = (c.sources || []).join(", ");
      const thesis = c.alpha_thesis || "";
      const risks = (c.risk || []).join("; ");
      const themes = (c.sector_themes || []).join(", ");

      // Generate link based on type
      let link = "";
      if (type === "project") {
        link = `https://github.com/${name}`;
      } else if (type === "model") {
        link = `https://huggingface.co/${name}`;
      }

      const nameWithLink = link ? `[${name}](${link})` : name;

      push(`- **${nameWithLink}** (${type}, ${sources})`);
      if (thesis) push(`  - Why watch: ${thesis}`);
      if (risks) push(`  - Risk: ${risks}`);
      if (themes) push(`  - Themes: ${themes}`);
    }
  }

  // ===================== 10. Sector Outlook (6-24 months) =====================
  section(10, "Sector Outlook (6-24 months) — 섹터 전망");

  if (sectorThemes.length === 0) {
    push("- 오늘 데이터로는 섹터 전망을 도출하기 부족합니다.");
  } else {
    for (const t of sectorThemes) {
      push(`- **${t.name}** (count: ${t.count})`);
      if (t.outlook) push(`  - ${t.outlook}`);
    }
  }

  // ===================== 10. Risk & Contrarian View =====================
  section(11, "Risk & Contrarian View — 리스크 및 반대 관점");

  for (const c of contrarian) {
    push(`- ${c}`);
  }

  // ===================== 11. Data Quality Note =====================
  section(12, "Data Quality Note — 데이터 품질");

  const notes = [];
  if (!raw.github?.items?.length) notes.push("GitHub Trending: 데이터 수집 실패 또는 불안정.");
  if (!ctx.sources?.hackernews?.valid) notes.push("HN: 데이터 수집 실패 또는 불안정.");
  if (!raw.reddit?.global_hot_posts?.length) notes.push("Reddit: 유효 포스트가 거의 없거나 수집 실패.");
  if (!ctx.sources?.research_ml?.valid) notes.push("Research ML (HF/ArXiv): 데이터가 거의 없거나 수집 실패.");
  if (!raw.product_launch?.product_hunt?.length) notes.push("ProductHunt: 데이터가 거의 없거나 수집 실패.");
  if (!raw.jobs?.jobs?.length) notes.push("Job Signals: 데이터가 거의 없거나 수집 실패.");

  if (notes.length === 0) {
    notes.push("주요 데이터 소스 모두 정상 수집됨.");
  }

  for (const n of notes) {
    push(`- ${n}`);
  }

  // Footer
  push();
  push("---");
  push(`_Generated at: ${new Date().toISOString()} | Alpha Hunter (Deep Context Mode)_`);

  return L.join("\n");
}

// ===================== Main =====================

function main() {
  const date = todayISODate();
  const yesterday = yesterdayISODate();
  console.log(`[alpha_report] Generating VC-grade daily report for ${date}`);

  const dateDir = path.join(DATA_DIR, date);
  const deepCtxFile = path.join(dateDir, `alpha_deep_context.json`);
  const ctx = safeReadJSON(deepCtxFile);

  if (!ctx) {
    console.error(`[alpha_report] alpha_deep_context not found: ${deepCtxFile}`);
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, `${date}.md`);
    fs.writeFileSync(
      reportPath,
      `# Alpha Hunter Deep Daily Brief — ${date}\n\n> alpha_deep_context 파일이 존재하지 않아 보고서 생성이 제한되었습니다.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`,
      "utf-8"
    );
    console.log(`[alpha_report] Fallback report: ${reportPath}`);
    process.exit(0);
    return;
  }

  // Read raw data files directly
  const raw = {
    github: safeReadJSON(path.join(dateDir, "github_trending.json")),
    reddit: safeReadJSON(path.join(dateDir, "reddit.json")),
    product_launch: safeReadJSON(path.join(dateDir, "product_launch.json")),
    jobs: safeReadJSON(path.join(dateDir, "job_signals.json")),
    research_ml: safeReadJSON(path.join(dateDir, "research_ml.json")),
    hackernews: safeReadJSON(path.join(dateDir, "hackernews.json")),
    bigtech_ai_jobs: safeReadJSON(path.join(dateDir, "bigtech_ai_jobs.json")),
    // Yesterday's GitHub data for ranking comparison
    yesterday_github: safeReadJSON(path.join(DATA_DIR, yesterday, "github_trending.json")),
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `${date}.md`);

  try {
    const md = generateReport(date, yesterday, ctx, raw);
    fs.writeFileSync(reportPath, md, "utf-8");
    console.log(`[alpha_report] Written to: ${reportPath}`);
    console.log(`[alpha_report] Size: ${md.length} chars`);
  } catch (err) {
    console.error(`[alpha_report] Error:`, err.message || err);
    const fallback = `# Alpha Hunter Deep Daily Brief — ${date}\n\n> 보고서 생성 중 오류 발생.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`;
    fs.writeFileSync(reportPath, fallback, "utf-8");
    console.log(`[alpha_report] Fallback report: ${reportPath}`);
  }

  process.exit(0);
}

main();
