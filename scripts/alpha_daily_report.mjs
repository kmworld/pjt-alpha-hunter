// scripts/alpha_daily_report.mjs
// Reads data/alpha_deep_context_<YYYY-MM-DD>.json and generates a
// deep-analysis Markdown daily report into reports/daily/YYYY-MM-DD.md.
// Node 22+ built-in only. No npm installs.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const REPORTS_DIR = path.join(PROJECT_ROOT, "reports", "daily");

function todayISODate() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error(`[alpha_report] Error reading ${filePath}:`, e.message);
    return null;
  }
}

function esc(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\*/g, "\\*").replace(/_/g, "\\_");
}

function generateReport(date, ctx) {
  const lines = [];
  const push = (s = "") => lines.push(s);
  const section = (title) => {
    push();
    push(`## ${title}`);
  };

  const src = ctx.sources || {};
  const sig = ctx.signals || {};
  const github = sig.github || {};
  const hn = sig.hackernews || {};
  const reddit = sig.reddit || {};
  const research = sig.research_ml || {};
  const product = sig.product_launch || {};
  const jobs = sig.jobs || {};
  const cross = ctx.cross_source || {};
  const candidates = ctx.candidates || [];

  // Title
  push(`# Alpha Hunter Daily Brief — ${date}`);
  push();
  push(`> 자동 생성된 일간 신호 분석 보고서. 소스: GitHub, HN, Reddit, HF/ArXiv, Product Hunt, Job Signals. Deep Context 기반 통합 분석.`);

  // 1) Executive Summary
  section("1. Executive Summary");

  const insights = [];

  if (src.github_trending?.valid) {
    insights.push(
      `GitHub Trending: ${src.github_trending.count}개 프로젝트 수집. AI/Agent/DevTools 관련 프로젝트 급증.`
    );
  }
  if (src.hackernews?.topCount) {
    insights.push(
      `Hacker News: Top ${src.hackernews.topCount}, Show HN ${src.hackernews.showHnCount} — 엔지니어 중심 부상 도구/프로젝트 다수.`
    );
  }
  if (src.reddit?.totalPosts) {
    insights.push(
      `Reddit: ${src.reddit.totalPosts}개 핫 포스트 분석 — 기술/크립토/스타트업 커뮤니티 주목.`
    );
  }
  if (src.research_ml?.hfCount || src.research_ml?.arxivCount) {
    insights.push(
      `Research/ML: HF ${src.research_ml.hfCount}, ArXiv ${src.research_ml.arxivCount} — AI/ML 연구와 오픈소스 모델 동향 활발.`
    );
  }
  if (src.product_launch?.productHuntCount || src.product_launch?.indieHackersCount) {
    insights.push(
      `Product Launch: PH ${src.product_launch.productHuntCount}, IH ${src.product_launch.indieHackersCount} — AI/DevTools/Workflow 자동화 제품 두각.`
    );
  }
  if (src.job_signals?.jobsCount) {
    insights.push(
      `Job Signals: ${src.job_signals.jobsCount}개 공고 — AI Infra, Agent, MLOps 관련 채용 급증.`
    );
  }

  if (insights.length === 0) {
    push("- 데이터 수집이 제한적이거나 실패하여 요약이 제한됩니다.");
  } else {
    for (const i of insights.slice(0, 6)) {
      push(`- ${i}`);
    }
  }

  // Cross-source highlights (if any)
  const overlaps = cross.overlap_candidates || [];
  if (overlaps.length >= 2) {
    push();
    push(`- **Cross-Source 신호:** ${overlaps.length}개 프로젝트/주제가 복수 소스에서 동시에 주목받고 있음.`);
  }

  // 2) GitHub Trending Signals
  section("2. GitHub Trending Signals");

  const topStars = github.topByStarsToday || [];
  const stacks = github.emerging_stacks || [];

  if (topStars.length) {
    push(`- 총 ${src.github_trending?.count || "?"}개 프로젝트 수집. 아래는 핵심 신호:`);
    push();
    for (const r of topStars) {
      const starsInfo = r.recent_stars
        ? `🔥 +${r.recent_stars} today`
        : r.stars
          ? `⭐ ${r.stars}`
          : "";
      const lang = r.language ? ` (${r.language})` : "";
      push(`- **[${r.repo}](${r.url})** ${starsInfo}${lang}`);
      if (r.description) push(`  - ${r.description}`);
      if (r.signal_reason) push(`  - _${r.signal_reason}_`);
    }
  } else {
    push("- GitHub Trending 데이터 없음 또는 수집 실패.");
  }

  if (stacks.length) {
    push();
    push(`- **Emerging Stacks:** ${stacks.join(", ")}`);
  }

  // 3) Hacker News / Show HN Highlights
  section("3. Hacker News / Show HN Highlights");

  const hnTop = hn.topByEngagement || [];
  const hnShow = hn.show_hn_high_signal || [];

  if (hnTop.length) {
    push("**Top Stories:**");
    for (const t of hnTop) {
      push(`- ${t.title} [${t.score}↑, 💬${t.comments}] ${t.url ? `(${t.url})` : ""}`);
      if (t.signal_reason) push(`  - _${t.signal_reason}_`);
    }
    push();
  }

  if (hnShow.length) {
    push("**Show HN (High Signal):**");
    for (const s of hnShow) {
      push(`- ${s.title} [${s.score}↑, 💬${s.comments}] ${s.url ? `(${s.url})` : ""}`);
      if (s.signal_reason) push(`  - _${s.signal_reason}_`);
    }
  }

  if (!hnTop.length && !hnShow.length) {
    push("- 의미 있는 항목 없음.");
  }

  // 4) Reddit Hot & Emerging
  section("4. Reddit Hot & Emerging");

  const hotTopics = reddit.hot_topics || [];
  const emergSubs = reddit.emerging_subreddits || [];

  if (hotTopics.length) {
    for (const t of hotTopics) {
      push(`**${t.topic}**`);
      for (const title of (t.sample_titles || []).slice(0, 3)) {
        push(`- ${title}`);
      }
      if (t.why_important) push(`  - _${t.why_important}_`);
      push();
    }
  }

  if (emergSubs.length) {
    push("**Hot & Emerging Subreddits:**");
    for (const hs of emergSubs) {
      const sample = hs.sample_titles
        ? ` — ${hs.sample_titles.slice(0, 2).join(", ")}`
        : "";
      push(`- **${hs.name}** (posts: ${hs.post_count || "?"})${sample}`);
    }
    push();
  }

  if (!hotTopics.length && !emergSubs.length) {
    push("- Reddit 데이터 없음.");
  }

  // 5) Research & ML
  section("5. Research & ML (Hugging Face + ArXiv)");

  const hfModels = research.trending_models || [];
  const arxivPapers = research.notable_papers || [];

  if (hfModels.length) {
    push("**Hugging Face Trending Models:**");
    for (const m of hfModels) {
      const tags = m.tags && m.tags.length ? ` [${m.tags.slice(0, 3).join(", ")}]` : "";
      push(`- **${m.id}** ❤️ ${m.likes || "?"}${tags}`);
      if (m.why_notable) push(`  - _${m.why_notable}_`);
    }
    push();
  }

  if (arxivPapers.length) {
    push("**ArXiv Highlights:**");
    for (const p of arxivPapers) {
      const authors = p.authors || "";
      push(`- **${p.title}** ${authors ? `(${authors})` : ""}`);
      if (p.abstract_short) {
        const trimmed = p.abstract_short.length > 140
          ? p.abstract_short.slice(0, 140) + "…"
          : p.abstract_short;
        push(`  - ${trimmed}`);
      }
      if (p.why_notable) push(`  - _${p.why_notable}_`);
    }
    push();
  }

  if (!hfModels.length && !arxivPapers.length) {
    push("- Research/ML 데이터 없음.");
  }

  // 6) Product Launch
  section("6. Product Launch (Product Hunt + Others)");

  const topProducts = product.top_products || [];

  if (topProducts.length) {
    for (const p of topProducts) {
      const votes = p.votes != null ? `🔼 ${p.votes}` : "";
      push(`- **${p.name}** ${votes}`);
      if (p.tagline) push(`  - ${p.tagline}`);
      if (p.why_notable) push(`  - _${p.why_notable}_`);
    }
  } else {
    push("- Product Launch 데이터 없음 또는 수집 실패.");
  }

  // 7) Job Signals
  section("7. Job Signals (Emerging Roles & Stacks)");

  const roles = jobs.emerging_roles || [];
  const skills = jobs.emerging_skills || [];

  if (roles.length) {
    push(`- 수집된 공고 기반 핵심 신호:`);
    push();
    for (const r of roles.slice(0, 6)) {
      push(`- **${r.role}** (count: ${r.count}) — ${r.example_companies.join(", ") || "?"}`);
      if (r.why_signal) push(`  - _${r.why_signal}_`);
    }
  } else {
    push("- Job Signals 데이터 없음 또는 수집 실패.");
  }

  if (skills.length) {
    push();
    push(`- **Emerging Skills:** ${skills.join(", ")}`);
  }

  // 8) Cross-Source Overlap
  section("8. Cross-Source Overlap (Multi-Signal Validation)");

  if (overlaps.length) {
    push(`> 복수 소스에서 동시에 포착된 프로젝트/주제 — 단순 노이즈가 아닌 가능성.`);
    push();
    for (const o of overlaps) {
      push(`- **${o.name}** (sources: ${o.sources.join(", ")})`);
      if (o.reason) push(`  - ${o.reason}`);
    }
  } else {
    push("- 복수 소스 중복 신호 없음.");
  }

  // 9) Alpha Candidates
  section("9. Alpha Candidates (Early-Stage Opportunities)");

  push(`> 각 소스에서 포착된 프로젝트/기술/스타트업 중 초기 단계의 알파 신호 후보.`);
  push();

  if (candidates.length) {
    for (const c of candidates) {
      push(`- **#${c.id} ${c.name}** (${c.type}) — sources: ${c.sources.join(", ")}`);
      if (c.summary) push(`  - ${c.summary}`);
      if (c.alpha_thesis) push(`  - _Alpha Thesis:_ ${c.alpha_thesis}`);
      if (c.risk) push(`  - _Risk:_ ${c.risk}`);
    }
  } else {
    push("- 오늘 데이터로 강한 알파 후보는 확인되지 않았습니다.");
  }

  // Footer
  push();
  push("---");
  push(`_Generated at: ${new Date().toISOString()} | Alpha Hunter Pipeline (Deep Context Mode)_`);

  return lines.join("\n");
}

function main() {
  const date = todayISODate();

  console.log(`[alpha_report] Generating daily report for ${date} (from deep_context)`);

  const deepCtxFile = path.join(DATA_DIR, `alpha_deep_context_${date}.json`);
  const ctx = safeReadJSON(deepCtxFile);

  if (!ctx) {
    console.error(`[alpha_report] alpha_deep_context file not found: ${deepCtxFile}`);
    // Write minimal fallback
    const reportsDir = REPORTS_DIR;
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, `${date}.md`);
    fs.writeFileSync(
      reportPath,
      `# Alpha Hunter Daily Brief — ${date}\n\n> alpha_deep_context 파일이 존재하지 않아 보고서 생성이 제한되었습니다.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`,
      "utf-8"
    );
    console.log(`[alpha_report] Fallback minimal report written to: ${reportPath}`);
    process.exit(0);
    return;
  }

  // Ensure reports dir
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportPath = path.join(REPORTS_DIR, `${date}.md`);

  try {
    const md = generateReport(date, ctx);
    fs.writeFileSync(reportPath, md, "utf-8");
    console.log(`[alpha_report] Report written to: ${reportPath}`);
    console.log(`[alpha_report] Size: ${md.length} chars`);
  } catch (err) {
    console.error(`[alpha_report] Error generating report:`, err.message || err);
    const minimal = `# Alpha Hunter Daily Brief — ${date}\n\n> 보고서 생성 중 오류 발생.\n\n- Deep Context 기반 렌더링 단계에서 문제가 발생했습니다.\n- 다음 실행 시 복구될 예정입니다.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`;
    fs.writeFileSync(reportPath, minimal, "utf-8");
    console.log(`[alpha_report] Fallback minimal report written to: ${reportPath}`);
  }

  process.exit(0);
}

main();
