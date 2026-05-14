// scripts/alpha_daily_report.mjs
// Reads data/alpha_deep_context_<YYYY-MM-DD>.json and generates an
// analyst-grade, discovery-oriented daily report into reports/daily/YYYY-MM-DD.md.
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
  } catch {
    console.error(`[alpha_report] Error reading ${filePath}`);
    return null;
  }
}

function toLower(s) {
  return (s || "").toLowerCase();
}

function extractThemesFromSignals(ctx) {
  const sig = ctx.signals || {};
  const themeCounts = {};

  function add(theme, source, example) {
    if (!themeCounts[theme]) {
      themeCounts[theme] = { sources: new Set(), count: 0, examples: [] };
    }
    themeCounts[theme].count++;
    themeCounts[theme].sources.add(source);
    if (themeCounts[theme].examples.length < 4) {
      themeCounts[theme].examples.push(example);
    }
  }

  const themePatterns = {
    "AI Agent Infra": ["agent", "agentic", "multi-agent", "agent memory", "agent tool"],
    "LLM / Reasoning": ["llm", "reasoning", "large language model", "grpo", "rlhf"],
    "Multimodal / Vision": ["multimodal", "vision", "image-gen", "video", "diffusion"],
    "On-Device / Edge AI": ["on-device", "edge ai", "quantize", "gguf"],
    "AI Coding / DevTools": ["code", "coding", "devtool", "ide"],
    "Crypto / ZK Infra": ["crypto", "blockchain", "zk", "defi", "token"],
    "AI Infra & MLOps": ["infra", "mlops", "training", "gpu", "inference"],
    "Security / Privacy": ["security", "privacy", "stealth", "bot detection"],
    "Physical AI / Robotics": ["robotics", "physical ai", "embodied"],
    "AI Policy / Society": ["regulation", "policy", "pessimist", "dividend"],
  };

  const github = sig.github || {};
  for (const r of github.topByStarsToday || []) {
    const text = toLower(`${r.repo} ${r.description || ""} ${r.why_notable || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "GitHub", r.repo);
    }
  }

  const hn = sig.hackernews || {};
  for (const h of hn.topByEngagement || []) {
    const text = toLower(`${h.title} ${h.signal_reason || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "HN", h.title.split(" ").slice(0, 6).join(" "));
    }
  }

  const reddit = sig.reddit || {};
  for (const t of reddit.hot_topics || []) {
    const text = toLower(`${t.topic} ${(t.sample_titles || []).join(" ")}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "Reddit", t.topic);
    }
  }

  const research = sig.research_ml || {};
  for (const m of research.trending_models || []) {
    const text = toLower(`${m.id} ${(m.tags || []).join(" ")} ${m.why_notable || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "HF", m.id);
    }
  }
  for (const p of research.notable_papers || []) {
    const text = toLower(`${p.title} ${p.abstract_short || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "ArXiv", p.title.split(" ").slice(0, 4).join(" "));
    }
  }

  const product = sig.product_launch || {};
  for (const p of product.top_products || []) {
    const text = toLower(`${p.name} ${p.tagline || ""} ${p.why_notable || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "ProductHunt", p.name);
    }
  }

  const jobs = sig.jobs || {};
  for (const r of jobs.emerging_roles || []) {
    const text = toLower(`${r.role} ${r.why_signal || ""}`);
    for (const [theme, kws] of Object.entries(themePatterns)) {
      if (kws.some(k => text.includes(k))) add(theme, "Jobs", r.role);
    }
  }

  const themes = [];
  for (const [theme, v] of Object.entries(themeCounts)) {
    themes.push({
      theme,
      count: v.count,
      sourceCount: v.sources.size,
      sources: [...v.sources],
      examples: v.examples,
    });
  }
  return themes.sort((a, b) => b.count - a.count || b.sourceCount - a.sourceCount);
}

function buildRiskBullets(ctx, themes) {
  const bullets = [];
  const themeSet = new Set(themes.map(t => t.theme));
  const contrarian = ctx.contrarian_notes || [];

  for (const c of contrarian) {
    if (c) bullets.push(c);
  }

  if (themeSet.has("AI Agent Infra") || themeSet.has("LLM / Reasoning")) {
    bullets.push(
      "AI Agent/LLM 과열: 급격한 Adoption과 과장된 기대가 공존. 실제 ROI가 입증되지 않은 영역에서 버블 위험 상시 존재."
    );
  }
  if (themeSet.has("Crypto / ZK Infra")) {
    bullets.push(
      "Crypto/ZK: 규제 불확실성과 기술 성숙도 문제로, 단기 성장보다 장기 불확실성이 더 큼."
    );
  }
  if (themeSet.has("AI Policy / Society")) {
    bullets.push(
      "AI 규제/정책: 사회적 우려가 실제 규제/제한으로 이어질 경우 일부 영역의 성장 속도가 둔화될 수 있음."
    );
  }
  if (themeSet.has("AI Infra & MLOps")) {
    bullets.push(
      "AI Infra 과부하: 데이터센터/전력/물리적 리소스 제약이 AI 확장 속도를 제한할 수 있음."
    );
  }

  if (bullets.length === 0) {
    bullets.push(
      "오늘 데이터만으로는 뚜렷한 반론 신호가 강하지 않으나, AI Agent/LLM 관련 과열 가능성은 상시 주의 대상."
    );
  }

  return bullets.slice(0, 5);
}

function buildDataQualityNote(ctx) {
  const notes = [];
  const src = ctx.sources || {};

  if (!src.github_trending?.valid) notes.push("GitHub Trending: 데이터 수집 실패 또는 불안정.");
  if (!src.hackernews?.valid) notes.push("HN: 데이터 수집 실패 또는 불안정.");
  if (!src.reddit?.totalPosts) notes.push("Reddit: 유효 포스트가 거의 없거나 수집 실패.");
  if (!src.research_ml?.hfCount && !src.research_ml?.arxivCount) {
    notes.push("Research ML (HF/ArXiv): 데이터가 거의 없거나 수집 실패.");
  }
  if (src.research_ml?.arxivRateLimited) {
    notes.push("ArXiv: Rate limit(429) 등으로 논문 데이터가 제한적일 수 있음.");
  }
  if (!src.product_launch?.productHuntCount) notes.push("ProductHunt: 데이터가 거의 없거나 수집 실패.");
  if (!src.job_signals?.jobsCount) notes.push("Job Signals: 데이터가 거의 없거나 수집 실패.");

  if (notes.length === 0) {
    notes.push("주요 데이터 소스 모두 정상 수집됨.");
  }

  return notes;
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

  const rawThemes = extractThemesFromSignals(ctx);
  const riskBullets = buildRiskBullets(ctx, rawThemes);
  const dataNotes = buildDataQualityNote(ctx);

  const newConcepts = ctx.new_concepts || [];
  const notablePapers = ctx.notable_papers || [];
  const emergingSkills = ctx.emerging_skills || [];
  const alphaProducts = ctx.alpha_products || [];
  const cryptoSignals = ctx.crypto_ticker_signals || [];
  const patentSignals = ctx.patent_like_signals || [];

  // ===== Title =====
  push(`# Alpha Hunter Deep Daily Brief — ${date}`);
  push();

  // ===== 1) Executive Summary =====
  section("1. Executive Summary");

  const execBullets = [];

  const ghCount = src.github_trending?.count || 0;
  const hnCount = src.hackernews?.topCount || 0;
  const rdPosts = src.reddit?.totalPosts || 0;
  const hfCount = src.research_ml?.hfCount || 0;
  const phCount = src.product_launch?.productHuntCount || 0;
  const jobCount = src.job_signals?.jobsCount || 0;

  const topThemes = rawThemes.filter(t => t.sourceCount >= 2).slice(0, 4);
  if (topThemes.length > 0) {
    const themeNames = topThemes.map(t => t.theme).join(", ");
    execBullets.push(
      `오늘 주요 키워드/테마: ${themeNames} — 복수 소스에서 동시 포착된 구조적 관심 영역.`
    );
  }

  if (ghCount > 0) {
    const agentProjects = (sig.github?.topByStarsToday || []).filter(
      r => /agent|agentic/i.test(r.description || "")
    ).length;
    execBullets.push(
      `GitHub Trending ${ghCount}개 중 AI Agent/DevTools 관련 프로젝트 강세${agentProjects > 2 ? `, 특히 Agent 관련 프로젝트 ${agentProjects}개` : ""}.`
    );
  }

  if (hnCount > 0 || rdPosts > 0) {
    execBullets.push(
      `HN(${hnCount})/Reddit(${rdPosts})에서 AI/ML, infra, crypto 관련 고engagement 포스트 다수 — 엔지니어/커뮤니티의 관심이 집중.`
    );
  }

  if (hfCount > 0) {
    execBullets.push(
      `HF/ArXiv에서 LLM, 멀티모달, agent 관련 모델/논문 강세 — 연구와 제품이 빠르게 연결.`
    );
  }

  if (phCount > 0) {
    execBullets.push(
      `ProductHunt에서 AI 관련 제품(${phCount}개) early traction 확인 — 시장 수요와 제품화 속도 증가.`
    );
  }

  if (jobCount > 0) {
    execBullets.push(
      `Job Signals ${jobCount}건 중 AI Infra, Agent, MLOps 관련 채용 비중 높음 — 자본과 인재 집중.`
    );
  }

  for (const b of execBullets.slice(0, 5)) {
    push(`- ${b}`);
  }

  // ===== 2) Today's Discoveries (New Concepts) =====
  section("2. Today's Discoveries (New Concepts)");

  if (newConcepts.length === 0) {
    push("- 오늘 데이터로는 새로운 개념/패러다임이 명확히 도출되지 않았습니다.");
  } else {
    for (const c of newConcepts) {
      push(`- **${c.name}**`);
      push(`  - 설명: ${c.description || "Recurring signal across sources."}`);
      push(`  - 포착처: ${c.sources?.join(", ") || "—"}`);
      push(`  - 중요도: ${c.why_important || "Emerging paradigm or infrastructure layer."}`);
    }
  }

  // ===== 3) Notable Papers & Models =====
  section("3. Notable Papers & Models");

  if (notablePapers.length === 0) {
    push("- 오늘 데이터로는 주목할 만한 논문/모델이 도출되지 않았습니다.");
  } else {
    for (const p of notablePapers) {
      push(`- **${p.title}**`);
      push(`  - 중요도: ${p.why_notable || "Relevant to current AI/ML/Agent research trends."}`);
      if (p.link) push(`  - 링크: ${p.link}`);
    }
  }

  // ===== 4) Emerging Skills & Roles =====
  section("4. Emerging Skills & Roles");

  if (emergingSkills.length === 0) {
    push("- 오늘 데이터로는 부상하는 스킬/역할이 도출되지 않았습니다.");
  } else {
    for (const s of emergingSkills) {
      push(`- **${s.skill}** (count: ${s.count})`);
      push(`  - 관련 기업: ${s.example_companies?.join(", ") || "—"}`);
      push(`  - 신호: ${s.why_signal || "Emerging skill with niche demand."}`);
    }
  }

  // ===== 5) Alpha Products & Startups =====
  section("5. Alpha Products & Startups");

  if (alphaProducts.length === 0) {
    push("- 오늘 데이터로는 주목할 만한 제품/스타트업이 도출되지 않았습니다.");
  } else {
    for (const p of alphaProducts) {
      push(`- **${p.name}**`);
      push(`  - 설명: ${p.what_it_does || "—"}`);
      push(`  - 주목 이유: ${p.why_interesting || "—"}`);
      if (p.cross_source) push(`  - Cross-source: ${p.cross_source}`);
    }
  }

  // ===== 6) Crypto / Ticker / Infra Signals =====
  section("6. Crypto / Ticker / Infra Signals");

  if (cryptoSignals.length === 0) {
    push("- 오늘 데이터로는 Crypto/Web3 관련 신호가 도출되지 않았습니다.");
  } else {
    for (const s of cryptoSignals) {
      push(`- **${s.project}** (${s.signal_type || "signal"})`);
      push(`  - Watch reason: ${s.why_watch || "—"}`);
    }
  }

  // ===== 7) Patent-like Signals (Early Innovation) =====
  section("7. Patent-like Signals (Early Innovation)");

  if (patentSignals.length === 0) {
    push("- 오늘 데이터로는 특허 수준의 초기 혁신 신호가 도출되지 않았습니다.");
  } else {
    for (const s of patentSignals) {
      push(`- **${s.concept}**`);
      push(`  - 포착처: ${s.where_seen || "—"}`);
      push(`  - 중요도: ${s.why_important || "—"}`);
    }
  }

  // ===== 8) Risk & Contrarian View =====
  section("8. Risk & Contrarian View");

  for (const r of riskBullets) {
    push(`- ${r}`);
  }

  // ===== 9) Data Quality Note =====
  section("9. Data Quality Note");

  for (const n of dataNotes) {
    push(`- ${n}`);
  }

  // Footer
  push();
  push("---");
  push(`_Generated at: ${new Date().toISOString()} | Alpha Hunter Pipeline (Deep Context Mode)_`);

  return lines.join("\n");
}

// ===== Main =====
function main() {
  const date = todayISODate();

  console.log(`[alpha_report] Generating daily report for ${date} (from deep_context)`);

  const deepCtxFile = path.join(DATA_DIR, `alpha_deep_context_${date}.json`);
  const ctx = safeReadJSON(deepCtxFile);

  if (!ctx) {
    console.error(`[alpha_report] alpha_deep_context file not found: ${deepCtxFile}`);
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, `${date}.md`);
    fs.writeFileSync(
      reportPath,
      `# Alpha Hunter Daily Brief — ${date}\n\n> alpha_deep_context 파일이 존재하지 않아 보고서 생성이 제한되었습니다.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`,
      "utf-8"
    );
    console.log(`[alpha_report] Fallback minimal report written to: ${reportPath}`);
    process.exit(0);
    return;
  }

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
    const minimal = `# Alpha Hunter Daily Brief — ${date}\n\n> 보고서 생성 중 오류 발생.\n\n---\n_Generated at: ${new Date().toISOString()}_\n`;
    fs.writeFileSync(reportPath, minimal, "utf-8");
    console.log(`[alpha_report] Fallback minimal report written to: ${reportPath}`);
  }

  process.exit(0);
}

main();
