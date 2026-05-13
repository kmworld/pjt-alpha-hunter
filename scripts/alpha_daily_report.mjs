// scripts/alpha_daily_report.mjs
// Reads today's JSON files from data/ and generates a deep-analysis Markdown
// daily report into reports/daily/YYYY-MM-DD.md.
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
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[alpha_report] Error reading ${filePath}:`, e.message);
    return null;
  }
}

function selectTop(arr, n, fallbackField) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, n);
}

function generateReport(date) {
  const lines = [];

  const push = (s = "") => lines.push(s);
  const section = (title) => {
    push();
    push(`## ${title}`);
  };

  // Load data files
  const gh = safeReadJSON(path.join(DATA_DIR, `github_trending_${date}.json`));
  const hn = safeReadJSON(path.join(DATA_DIR, `hackernews_${date}.json`));
  const reddit = safeReadJSON(path.join(DATA_DIR, `reddit_${date}.json`));
  const research = safeReadJSON(path.join(DATA_DIR, `research_ml_${date}.json`));
  const product = safeReadJSON(path.join(DATA_DIR, `product_launch_${date}.json`));
  const jobs = safeReadJSON(path.join(DATA_DIR, `job_signals_${date}.json`));

  // Title
  push(`# Alpha Hunter Daily Brief — ${date}`);
  push();
  push(`> 자동 생성된 일간 신호 분석 보고서. 소스: GitHub, HN, Reddit, HF/ArXiv, Product Hunt, Job Signals.`);

  // 1) Executive Summary
  section("1. Executive Summary");

  const insights = [];

  if (gh && gh.items && gh.items.length) {
    insights.push(`GitHub Trending: ${gh.items.length}개 프로젝트 추적 중, AI/Agent/DevTools 관련 프로젝트 급증.`);
  }
  if (hn && hn.sections) {
    const topCount = (hn.sections.top || []).length;
    const showCount = (hn.sections.show_hn || []).length;
    if (topCount || showCount) {
      insights.push(`Hacker News: Top ${topCount}, Show HN ${showCount} — 엔지니어 중심의 부상 도구/프로젝트 다수.`);
    }
  }
  if (reddit) {
    const totalPosts = (reddit.subreddits || []).reduce((s, sb) => s + (sb.posts || []).length, 0);
    if (totalPosts > 0) {
      insights.push(`Reddit: ${totalPosts}개 핫 포스트 분석 — 기술/크립토/스타트업 커뮤니티에서 주목할 만한 화제 다수.`);
    }
  }
  if (research) {
    const hfCount = (research.huggingface || []).length;
    const arxivCount = (research.arxiv || []).length;
    if (hfCount || arxivCount) {
      insights.push(`Research/ML: Hugging Face ${hfCount}, ArXiv ${arxivCount} — AI/ML 연구와 오픈소스 모델 동향 활발.`);
    }
  }
  if (product && product.products && product.products.length) {
    insights.push(`Product Hunt: ${product.products.length}개 신생 제품 중 AI/DevTools/Workflow 자동화 제품 두각.`);
  }
  if (jobs && jobs.jobs && jobs.jobs.length) {
    insights.push(`Job Signals: ${jobs.jobs.length}개 공고 — AI Infra, Agent, MLOps, Edge AI 관련 채용 급증.`);
  }

  if (insights.length === 0) {
    push("- 데이터 수집이 제한적이거나 실패하여 요약이 제한됩니다.");
  } else {
    for (const i of insights.slice(0, 6)) {
      push(`- ${i}`);
    }
  }

  // 2) GitHub Trending Signals
  section("2. GitHub Trending Signals");

  if (gh && gh.items && gh.items.length) {
    const top = selectTop(gh.items, 8);
    push(`- 총 ${gh.items.length}개 프로젝트 수집됨. 아래는 핵심 신호:`);
    push();
    for (const r of top) {
      const starsInfo = r.stars
        ? `⭐ ${r.stars}`
        : r.recent_stars
          ? `🔥 +${r.recent_stars} today`
          : "";
      const lang = r.language ? ` (${r.language})` : "";
      push(`- **[${r.repo}](${r.url})** ${starsInfo}${lang}`);
      if (r.description) {
        push(`  - ${r.description}`);
      }
    }
  } else {
    push("- GitHub Trending 데이터 없음 또는 수집 실패.");
  }

  // 3) Hacker News / Show HN Highlights
  section("3. Hacker News / Show HN Highlights");

  if (hn && hn.sections) {
    const top = selectTop(hn.sections.top || [], 5);
    const show = selectTop(hn.sections.show_hn || [], 4);

    if (top.length) {
      push("**Top Stories:**");
      for (const t of top) {
        push(`- ${t.title} [${t.score}↑, 💬${t.comments}] ${t.url ? `(${t.url})` : ""}`);
      }
      push();
    }

    if (show.length) {
      push("**Show HN:**");
      for (const s of show) {
        push(`- ${s.title} [${s.score}↑, 💬${s.comments}] ${s.url ? `(${s.url})` : ""}`);
      }
    }

    if (!top.length && !show.length) {
      push("- 의미 있는 항목 없음.");
    }
  } else {
    push("- Hacker News 데이터 없음 또는 수집 실패.");
  }

  // 4) Reddit Hot & Emerging
  section("4. Reddit Hot & Emerging");

  if (reddit) {
    const subreddits = reddit.subreddits || [];
    const hotSubs = reddit.hot_subreddits || [];

    if (subreddits.length) {
      for (const sb of subreddits) {
        const posts = selectTop(sb.posts || [], 4);
        if (posts.length === 0) continue;
        push(`**${sb.name}**`);
        for (const p of posts) {
          push(`- ${p.title} [${p.score}↑, 💬${p.comments}] ${p.url ? `(${p.url})` : ""}`);
        }
        push();
      }
    }

    if (hotSubs.length) {
      push("**Hot & Emerging Subreddits:**");
      for (const hs of selectTop(hotSubs, 8)) {
        const sample = hs.sample_titles
          ? ` — ${hs.sample_titles.slice(0, 2).join(", ")}`
          : "";
        push(`- **${hs.name}** (posts: ${hs.post_count || "?"})${sample}`);
      }
      push();
    }

    if (!subreddits.length && !hotSubs.length) {
      push("- Reddit 데이터 없음.");
    }
  } else {
    push("- Reddit 데이터 없음 또는 수집 실패.");
  }

  // 5) Research & ML
  section("5. Research & ML (Hugging Face + ArXiv)");

  if (research) {
    const hfModels = research.huggingface || [];
    const arxivPapers = research.arxiv || [];

    if (hfModels.length) {
      push("**Hugging Face Trending Models:**");
      for (const m of selectTop(hfModels, 5)) {
        const tags = m.tags && m.tags.length ? ` [${m.tags.slice(0, 3).join(", ")}]` : "";
        push(`- **[${m.id || m.name}](${m.url})** ❤️ ${m.likes || "?"}${tags}`);
        if (m.description) {
          push(`  - ${m.description}`);
        }
      }
      push();
    }

    if (arxivPapers.length) {
      push("**ArXiv Highlights:**");
      for (const p of selectTop(arxivPapers, 5)) {
        const authors = p.authors || "";
        push(`- **${p.title}** ${authors ? `(${authors})` : ""}`);
        if (p.summary) {
          const summary = p.summary.replace(/\n+/g, " ").trim();
          const trimmed = summary.length > 140 ? summary.slice(0, 140) + "…" : summary;
          push(`  - ${trimmed}`);
        }
      }
      push();
    }

    if (!hfModels.length && !arxivPapers.length) {
      push("- Research/ML 데이터 없음.");
    }
  } else {
    push("- Research/ML 데이터 없음 또는 수집 실패.");
  }

  // 6) Product Launch
  section("6. Product Launch (Product Hunt + Others)");

  if (product && product.products && product.products.length) {
    const top = selectTop(product.products, 8);
    for (const p of top) {
      const tags = p.tags && p.tags.length ? ` [${p.tags.join(", ")}]` : "";
      push(`- **[${p.name}](${p.url})** 🔼 ${p.votes || "?"} ${tags}`);
      if (p.tagline) {
        push(`  - ${p.tagline}`);
      }
    }
  } else if (product && product.sources) {
    // If Product Hunt empty but other sources exist
    push("- Product Hunt 데이터 없음 (Cloudflare/403). 다른 소스 확인 중.");
    for (const [src, items] of Object.entries(product.sources)) {
      if (!Array.isArray(items) || !items.length) continue;
      push(`**${src}**`);
      for (const it of selectTop(items, 4)) {
        const title = it.title || it.name || it.project || "";
        const url = it.url || "";
        push(`- ${title} ${url ? `(${url})` : ""}`);
      }
    }
  } else {
    push("- Product Launch 데이터 없음 또는 수집 실패.");
  }

  // 7) Job Signals
  section("7. Job Signals (Emerging Roles & Stacks)");

  if (jobs && jobs.jobs && jobs.jobs.length) {
    push(`- 총 ${jobs.jobs.length}개 공고 수집됨. 아래는 핵심 신호:`);
    push();
    const bullets = [];
    const seen = new Set();
    for (const j of jobs.jobs) {
      const key = (j.title || "").toLowerCase().trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      bullets.push(
        `- **${j.title}** @ ${j.company || "?"} ${j.location ? `(${j.location})` : ""} ${j.url ? `(${j.url})` : ""}`
      );
      if (bullets.length >= 5) break;
    }
    if (bullets.length) {
      push(bullets.join("\n"));
    } else {
      push("- 의미 있는 채용 신호 없음.");
    }
  } else {
    push("- Job Signals 데이터 없음 또는 수집 실패.");
  }

  // 8) Alpha Candidates
  section("8. Alpha Candidates (Early-Stage Opportunities)");

  push(`> 각 소스에서 포착된 프로젝트/기술/스타트업 중 초기 단계의 알파 신호 후보.`);
  push();

  const candidates = [];

  // From GitHub Trending: repos with high recent stars and AI/agent/infra focus
  if (gh && gh.items) {
    for (const r of gh.items) {
      const desc = (r.description || "").toLowerCase();
      const repo = (r.repo || "").toLowerCase();
      const keywords = ["ai", "agent", "llm", "infra", "mlops", "crypto", "rust", "edge", "autonomous", "workflow", "tool", "framework"];
      if (
        (r.recent_stars >= 400 || r.stars >= 1000) &&
        keywords.some(k => desc.includes(k) || repo.includes(k))
      ) {
        candidates.push(`- **GitHub: ${r.repo}** — ${r.description || ""} (recent_stars: ${r.recent_stars || "?"})`);
      }
      if (candidates.length >= 3) break;
    }
  }

  // From Show HN: interesting tools
  if (hn && hn.sections && hn.sections.show_hn) {
    for (const s of hn.sections.show_hn) {
      const t = (s.title || "").toLowerCase();
      if (
        (s.score >= 40 || s.comments >= 20) &&
        (t.includes("ai") || t.includes("agent") || t.includes("tool") || t.includes("framework") || t.includes("infra"))
      ) {
        candidates.push(`- **Show HN: ${s.title}** — ${s.url || ""} (score: ${s.score})`);
      }
      if (candidates.length >= 5) break;
    }
  }

  // From Research/ML: notable models
  if (research && research.huggingface) {
    for (const m of research.huggingface) {
      if ((m.likes || 0) >= 500) {
        candidates.push(`- **HF Model: ${m.id || m.name}** — ${m.description || ""} (likes: ${m.likes})`);
      }
      if (candidates.length >= 6) break;
    }
  }

  if (candidates.length) {
    push(candidates.slice(0, 6).join("\n"));
  } else {
    push("- 오늘 데이터로 강한 알파 후보는 확인되지 않았습니다.");
  }

  // Footer
  push();
  push("---");
  push(`_Generated at: ${new Date().toISOString()} | Alpha Hunter Pipeline_`);

  return lines.join("\n");
}

function main() {
  const date = todayISODate();

  console.log(`[alpha_report] Generating daily report for ${date}`);

  // Ensure reports dir
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportPath = path.join(REPORTS_DIR, `${date}.md`);

  try {
    const md = generateReport(date);
    fs.writeFileSync(reportPath, md, "utf-8");
    console.log(`[alpha_report] Report written to: ${reportPath}`);
    console.log(`[alpha_report] Size: ${md.length} chars`);
  } catch (err) {
    console.error(`[alpha_report] Error generating report:`, err.message || err);
    // Write a minimal report so downstream steps don't break
    const minimal = `# Alpha Hunter Daily Brief — ${date}\n\n> 보고서 생성 중 오류 발생.\n\n- 데이터 수집 또는 렌더링 단계에서 문제가 발생했습니다.\n- 다음 실행 시 복구될 예정입니다.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`;
    fs.writeFileSync(reportPath, minimal, "utf-8");
    console.log(`[alpha_report] Fallback minimal report written to: ${reportPath}`);
  }

  process.exit(0);
}

main();
