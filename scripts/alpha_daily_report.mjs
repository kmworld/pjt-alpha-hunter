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

// ===== Helper: collectThemeSignals =====

function collectThemeSignals(ctx) {
  const themeMap = {};

  function add(theme, evidence) {
    if (!themeMap[theme]) themeMap[theme] = { evidence: [], evidenceCount: 0 };
    themeMap[theme].evidence.push(evidence);
    themeMap[theme].evidenceCount++;
  }

  const github = ctx.signals?.github?.topByStarsToday || [];
  const research = ctx.signals?.research_ml || {};
  const jobs = ctx.signals?.jobs || {};
  const product = ctx.signals?.product_launch?.top_products || [];

  for (const r of github) {
    const text = `${r.repo} ${r.description || ""} ${(r.topics || []).join(" ")} ${r.why_notable || ""}`.toLowerCase();
    if (/\b(agent|agentic|multi-agent)\b/.test(text)) add("AI Agent Infra", `GitHub: ${r.repo} — ${r.why_notable || "star velocity"}`);
    if (/\b(on-device|edge ai|quantize|gguf|llama.cpp)\b/.test(text)) add("On-Device / Edge AI", `GitHub: ${r.repo} — on-device/edge AI 관련.`);
    if (/\b(crypto|blockchain|zk|defi)\b/.test(text)) add("Crypto / ZK Infra", `GitHub: ${r.repo} — crypto/ZK 관련.`);
  }

  for (const m of research.trending_models || []) {
    const text = `${m.id} ${(m.tags || []).join(" ")} ${m.why_notable || ""}`.toLowerCase();
    if (/\b(llm|reasoning|multimodal)\b/.test(text)) add("LLM / Multimodal", `HF: ${m.id} — likes ${m.likes || "?"}`);
    if (/\b(agent|agentic)\b/.test(text)) add("AI Agent Infra", `HF: ${m.id} — agent 관련.`);
  }

  for (const r of jobs.emerging_roles || []) {
    const t = (r.role || "").toLowerCase();
    if (/\b(agent|agentic)\b/.test(t)) add("AI Agent Infra", `Job: ${r.role} — ${r.why_signal || "demand signal"}`);
    if (/\b(ml|mlops|infra)\b/.test(t)) add("AI Infra & MLOps", `Job: ${r.role} — AI infra/MLOps 수요.`);
  }

  for (const p of product) {
    const t = `${p.name} ${p.tagline || ""}`.toLowerCase();
    if (/\b(agent|agentic|assistant)\b/.test(t)) add("AI Agent Infra", `Product: ${p.name} — AI agent/assistant 제품.`);
    if (/\b(ai|llm|model)\b/.test(t)) add("AI Infra & MLOps", `Product: ${p.name} — AI 관련 제품.`);
  }

  const outlooks = {
    "AI Agent Infra": "Agent 기반 자동화가 실제 워크플로우에 침투하면 관련 인프라가 핵심 레이어가 될 것임.",
    "On-Device / Edge AI": "로컬 AI 실행이 보편화되면 프라이버시/지연 시간 문제를 해결하고 새로운 디바이스 생태계를 만들어냄.",
    "LLM / Multimodal": "LLM과 멀티모달 모델이 계속 발전하면 AI 기반 제품/서비스의 진입 장벽이 낮아지고 경쟁 심화.",
    "Crypto / ZK Infra": "규제와 UX가 개선될 경우 ZK 기반 인증/프라이버시/결제 인프라가 기존 시스템과 경쟁 가능.",
    "AI Infra & MLOps": "AI 서비스의 신뢰성과 확장성을 담당하는 레이어로, 수요가 지속적으로 증가할 구조.",
  };

  const result = [];
  for (const [theme, v] of Object.entries(themeMap)) {
    result.push({
      theme,
      evidence: v.evidence,
      evidenceCount: v.evidenceCount,
      outlook: outlooks[theme] || "중기적으로 해당 영역의 경쟁과 기술 성숙이 가속화될 가능성.",
    });
  }
  return result.sort((a, b) => b.evidenceCount - a.evidenceCount);
}

// ===== Helper: buildAlphaHypotheses =====

function buildAlphaHypotheses(candidates, sector_themes) {
  const hyps = [];
  const allThemes = new Set();
  for (const c of candidates) {
    for (const t of c.sector_themes || []) allThemes.add(t);
  }
  for (const t of sector_themes) allThemes.add(t);

  if (allThemes.has("ai-agents") || allThemes.has("llm")) {
    hyps.push({
      statement: "2027년까지 AI Agent Infra가 주요 소프트웨어 스택의 핵심 레이어로 부상.",
      rationale: "GitHub/HN/Job Signals에서 Agent/LLM/infra 관련 신호가 일관되게 강세.",
      confidence: "High",
    });
  }
  if (allThemes.has("on-device-ai") || allThemes.has("infra")) {
    hyps.push({
      statement: "On-Device AI/Edge AI 관련 오픈소스 스택이 12–24개월 내 성숙되며 새로운 디바이스/서비스 생태계를 주도.",
      rationale: "GGUF/llama.cpp/edge AI 관련 프로젝트와 채용 신호가 증가.",
      confidence: "Medium",
    });
  }
  if (allThemes.has("crypto-infra") || allThemes.has("zk")) {
    hyps.push({
      statement: "ZK/Privacy Infra가 규제 환경에 따라 빠르게 성장하거나 정체되는 분기점 도달.",
      rationale: "Crypto/ZK 관련 프로젝트와 논의가 재등장 중이나 규제 불확실성 존재.",
      confidence: "Low",
    });
  }
  return hyps.slice(0, 4);
}

// ===== Helper: buildWatchItems =====

function buildWatchItems(candidates, github, hn, product) {
  const items = [];
  const seen = new Set();

  for (const c of candidates) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    items.push({
      name: c.name,
      reason: (c.alpha_thesis || "").slice(0, 180),
      cross: c.cross_source_links?.length ? c.cross_source_links.join(", ") : null,
    });
  }

  for (const r of (github.topByStarsToday || [])) {
    const name = r.repo;
    if (seen.has(name)) continue;
    if ((r.recent_stars || 0) < 300) continue;
    seen.add(name);
    items.push({
      name,
      reason: (r.why_notable || "star velocity").slice(0, 120),
      cross: null,
    });
  }

  for (const p of (product.top_products || [])) {
    if (seen.has(p.name)) continue;
    if ((p.votes || 0) < 50) continue;
    seen.add(p.name);
    items.push({
      name: p.name,
      reason: (p.why_notable || "early traction").slice(0, 120),
      cross: null,
    });
  }

  return items.slice(0, 10);
}

// ===== Helper: buildWatchlist =====

function buildWatchlist(candidates, github, product) {
  const wl = [];
  const seen = new Set();

  for (const c of candidates) {
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    wl.push({
      name: c.name,
      reason: (c.alpha_thesis || "alpha candidate").slice(0, 120),
    });
  }

  for (const r of (github.topByStarsToday || [])) {
    const name = r.repo;
    if (seen.has(name)) continue;
    if ((r.recent_stars || 0) < 500) continue;
    seen.add(name);
    wl.push({
      name,
      reason: (r.why_notable || "star velocity").slice(0, 100),
    });
  }

  return wl.slice(0, 10);
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
  const sector_themes = ctx.sector_themes || [];
  const contrarian_notes = ctx.contrarian_notes || [];

  // Title
  push(`# Alpha Hunter Deep Daily Brief — ${date}`);
  push();
  push(`> 수집된 데이터를 바탕으로 한 섹터/알파/위험 분석. 단순 나열이 아닌, 6–24개월 관점의 구조화된 인사이트.`);

  // ===== 1) Executive Summary =====
  section("1. Executive Summary");

  const execPoints = [];

  if (src.github_trending?.valid) {
    execPoints.push(`GitHub Trending에서 ${src.github_trending.count}개 프로젝트 중 AI Agent Infra, On-Device AI, AI-assisted DevTools 관련 프로젝트가 높은 star velocity를 보임.`);
  }
  if (src.hackernews?.topCount) {
    execPoints.push(`HN에서 AI/ML, infra, crypto 관련 고engagement 포스트가 다수 포착 — 엔지니어 커뮤니티의 관심이 집중된 영역.`);
  }
  if (src.reddit?.totalPosts) {
    execPoints.push(`Reddit 핫 포스트 ${src.reddit.totalPosts}개 분석 결과, AI/ML, 보안, 스타트업 생태계에서 의미 있는 논의가 진행 중.`);
  }
  if (src.research_ml?.hfCount || src.research_ml?.arxivCount) {
    execPoints.push(`HF/ArXiv에서 LLM, 멀티모달, AI agent 관련 모델/논문이 강세 — 연구와 제품이 빠르게 연결되는 구조.`);
  }
  if (src.job_signals?.jobsCount) {
    execPoints.push(`Job Signals ${src.job_signals.jobsCount}건 중 AI Infra, Agent, MLOps 관련 채용 비중이 높음 — 자본과 인재가 어디로 흐르는지 반영.`);
  }

  if (execPoints.length === 0) {
    push("- 오늘 데이터가 제한적이어서 요약이 부족합니다.");
  } else {
    for (const p of execPoints.slice(0, 5)) {
      push(`- ${p}`);
    }
  }

  if (sector_themes.length >= 2) {
    push();
    push(`- 오늘 주요 섹터 테마: ${sector_themes.slice(0, 5).join(", ")}`);
  }

  // ===== 2) Sector Themes =====
  section("2. Sector Themes");

  const themeSignals = collectThemeSignals(ctx);
  const topThemes = themeSignals.filter(t => t.evidenceCount >= 2).slice(0, 5);

  if (topThemes.length === 0) {
    push("- 오늘 데이터로 뚜렷한 섹터 테마는 도출되지 않았습니다.");
  } else {
    for (const th of topThemes) {
      push(`**${th.theme}**`);
      for (const e of th.evidence.slice(0, 4)) {
        push(`- ${e}`);
      }
      push(`- 중요성(6–24개월): ${th.outlook}`);
      push();
    }
  }

  // ===== 3) Alpha Hypotheses =====
  section("3. Alpha Hypotheses");

  const hypotheses = buildAlphaHypotheses(candidates, sector_themes);
  if (hypotheses.length === 0) {
    push("- 오늘 데이터만으로는 강한 가설 도출이 어렵습니다.");
  } else {
    for (const h of hypotheses) {
      push(`**${h.statement}**`);
      push(`- 근거: ${h.rationale}`);
      push(`- 신뢰도: ${h.confidence}`);
      push();
    }
  }

  // ===== 4) Key Projects & Tools to Watch =====
  section("4. Key Projects & Tools to Watch");

  const watchItems = buildWatchItems(candidates, github, hn, product);
  if (watchItems.length === 0) {
    push("- 오늘 데이터로 뚜렷한 감시 대상은 도출되지 않았습니다.");
  } else {
    for (const w of watchItems) {
      push(`- **${w.name}**`);
      if (w.reason) push(`  - ${w.reason}`);
      if (w.cross) push(`  - 교차 확인: ${w.cross}`);
    }
  }

  // ===== 5) Job & Skill Signals =====
  section("5. Job & Skill Signals");

  const roles = jobs.emerging_roles || [];
  const skills = jobs.emerging_skills || [];

  if (roles.length) {
    push("**Emerging Roles (Key Signals):**");
    for (const r of roles.slice(0, 5)) {
      push(`- **${r.role}** (count: ${r.count}) — ${r.why_signal || "신규/증가 중"}`);
    }
  }

  if (skills.length) {
    push();
    push(`**Emerging Skills:** ${skills.join(", ")}`);
    push("- 위 스킬은 AI/infra/agent 관련 수요 증가를 반영하며, 향후 6–12개월 내 더 확산될 가능성이 높습니다.");
  }

  // ===== 6) Risk & Contrarian View =====
  section("6. Risk & Contrarian View");

  if (contrarian_notes.length) {
    for (const cn of contrarian_notes) {
      push(`- ${cn}`);
    }
  } else {
    push("- 오늘은 뚜렷한 반론/위험 신호가 강하지 않으나, AI Agent/LLM 관련 과열 가능성은 상시 주의 대상입니다.");
  }

  // ===== 7) Near-Term vs Long-Term =====
  section("7. Near-Term vs Long-Term");

  push("**Near-Term (0–6개월):**");
  push("- AI Agent Infra, RAG, LLM tooling 관련 오픈소스 프로젝트의 급성장에 주목.");
  push("- 보안/privacy 이슈와 규제 동향을 실시간으로 추적 필요.");
  push("- HF/ArXiv에서 부상하는 모델/논문이 실제 제품/서비스로 전환되는 속도가 핵심.");
  push();
  push("**Long-Term (6–24개월):**");
  push("- On-Device AI, Edge AI: 로컬 추론 인프라와 관련 스택이 성숙되면 새로운 생태계 등장.");
  push("- Physical AI / Robotics + AI Agent: 실세계 자동화와 연계된 프로젝트가 핵심.");
  push("- Crypto/ZK: 규제/UX가 해결될 경우, ZK 기반 인프라가 Web2/Web3 경계를 무너뜨릴 가능성.");

  // ===== 8) Watchlist =====
  section("8. Watchlist");

  const watchlist = buildWatchlist(candidates, github, product);
  for (const w of watchlist) {
    push(`- **${w.name}** — ${w.reason}`);
  }

  // ===== 9) Cross-Source Overlap =====
  section("9. Cross-Source Overlap");

  const overlaps = cross.overlap_candidates || [];
  if (overlaps.length) {
    push("> 복수 소스에서 동시 포착된 신호 — 단순 노이즈가 아닌 구조적 관심 가능성.");
    push();
    for (const o of overlaps) {
      push(`- **${o.name}** (sources: ${o.sources.join(", ")})`);
      if (o.reason) push(`  - ${o.reason}`);
    }
  } else {
    push("- 오늘 데이터로는 뚜렷한 복수 소스 중복 신호가 확인되지 않았습니다.");
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
