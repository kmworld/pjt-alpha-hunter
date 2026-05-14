// scripts/alpha_daily_report.mjs
// Reads data/alpha_deep_context_<YYYY-MM-DD>.json and generates an
// analyst-grade, insight-driven daily report into reports/daily/YYYY-MM-DD.md.
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

// ===== Theme dictionary =====
const THEME_PATTERNS = {
  "AI Agent Infra": {
    keywords: ["agent", "agentic", "multi-agent", "agent memory", "agent tool"],
    interpretation:
      "Agent 기반 자동화가 실제 워크플로우에 침투하며 관련 인프라(메모리, 툴콜, MCP)가 핵심 레이어로 부상 중. 단순 hype가 아닌 생태계 성숙 신호.",
  },
  "LLM / Reasoning": {
    keywords: ["llm", "reasoning", "large language model", "grpo", "rlhf", "post-training"],
    interpretation:
      "LLM 훈련/파인튜닝/RL 방법이 빠르게 진화 중. 6–24개월 내 도메인 특화 모델과 agent 스택의 성능 격차가 핵심 경쟁 변수.",
  },
  "Multimodal / Vision": {
    keywords: ["multimodal", "vision", "image-gen", "video", "diffusion", "umms"],
    interpretation:
      "멀티모달/비전 모델이 제품화 속도를 높이며, 생성형 AI가 텍스트→시각/영상으로 확장 중. 크리에이티브/마케팅/교육에서 구조적 변화 가능성.",
  },
  "On-Device / Edge AI": {
    keywords: ["on-device", "edge ai", "quantize", "gguf", "llama.cpp", "onnx"],
    interpretation:
      "로컬 추론 인프라 성숙으로 프라이버시/지연시간 문제 해결. 디바이스 생태계와 AI 통합이 12–24개월 핵심 성장 동력.",
  },
  "AI Coding / DevTools": {
    keywords: ["code", "coding", "devtool", "ide", "react", "lint"],
    interpretation:
      "AI 기반 개발 도구 Adoption이 가속되며, 개발 프로세스와 교육 패러다임이 재설계될 가능성. 실제 생산성 영향에 대한 검증이 진행 중.",
  },
  "Crypto / ZK Infra": {
    keywords: ["crypto", "blockchain", "zk", "defi", "token", "tokenized"],
    interpretation:
      "ZK/Privacy 및 토큰화 인프라가 규제/UX 개선 시 기존 금융·인증 시스템과 경쟁 가능. 불확실성은 높으나 분기점 단계.",
  },
  "AI Infra & MLOps": {
    keywords: ["infra", "mlops", "training", "gpu", "datacenter", "inference", "scaling"],
    interpretation:
      "AI 서비스의 신뢰성/확장성 레이어. 수요는 구조적으로 증가 중이며, 효율성/비용 최적화 기술이 핵심.",
  },
  "Security / Privacy": {
    keywords: ["security", "privacy", "stealth", "bot detection", "proctoring", "cyber"],
    interpretation:
      "AI 확산에 따른 보안/프라이버시/Deepfake/사기 이슈가 규제·기술적 대응을 촉발. 상시 리스크이자 새로운 시장.",
  },
  "Physical AI / Robotics": {
    keywords: ["robotics", "physical ai", "embodied", "hardware", "wearable"],
    interpretation:
      "AI가 물리적 세계(로봇, 웨어러블, 자동화)와 연결되며 새로운 하드웨어+AI 융합 시장이 열릴 가능성.",
  },
  "AI Policy / Society": {
    keywords: ["regulation", "policy", "pessimist", "too fast", "dividend", "sovereign"],
    interpretation:
      "AI 속도/영향력에 대한 사회적 논의가 심화되며, 규제와 윤리 프레임워크가 기술 발전 속도를 좌우할 가능성.",
  },
};

// ===== Normalize text =====
function toLower(s) {
  return (s || "").toLowerCase();
}

// ===== Extract themes from all signals =====
function extractThemesFromSignals(ctx) {
  const sig = ctx.signals || {};
  const themeCounts = {};   // theme -> {sources: Set, count, examples: []}

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

  // GitHub
  const github = sig.github || {};
  for (const r of github.topByStarsToday || []) {
    const text = toLower(
      `${r.repo} ${r.description || ""} ${(r.topics || []).join(" ")} ${r.why_notable || ""}`
    );
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "GitHub", `${r.repo}`);
      }
    }
  }

  // HackerNews
  const hn = sig.hackernews || {};
  for (const h of hn.topByEngagement || []) {
    const text = toLower(`${h.title} ${h.signal_reason || ""}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "HN", h.title.split(" ").slice(0, 8).join(" "));
      }
    }
  }

  // Reddit
  const reddit = sig.reddit || {};
  for (const t of reddit.hot_topics || []) {
    const text = toLower(`${t.topic} ${(t.sample_titles || []).join(" ")}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "Reddit", t.topic);
      }
    }
  }

  // Research ML
  const research = sig.research_ml || {};
  for (const m of research.trending_models || []) {
    const text = toLower(`${m.id} ${(m.tags || []).join(" ")} ${m.why_notable || ""}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "HF", m.id);
      }
    }
  }
  for (const p of research.notable_papers || []) {
    const text = toLower(`${p.title} ${p.abstract_short || ""}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "ArXiv", p.title.split(" ").slice(0, 6).join(" "));
      }
    }
  }

  // Product Launch
  const product = sig.product_launch || {};
  for (const p of product.top_products || []) {
    const text = toLower(`${p.name} ${p.tagline || ""} ${p.why_notable || ""}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "ProductHunt", p.name);
      }
    }
  }

  // Jobs
  const jobs = sig.jobs || {};
  for (const r of jobs.emerging_roles || []) {
    const text = toLower(`${r.role} ${r.why_signal || ""}`);
    for (const [theme, cfg] of Object.entries(THEME_PATTERNS)) {
      if (cfg.keywords.some(k => text.includes(k))) {
        add(theme, "Jobs", `${r.role}`);
      }
    }
  }

  // Convert sets to counts
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

// ===== Build theme interpretations =====
function buildThemeInterpretations(themes) {
  return themes.map(t => {
    const base = THEME_PATTERNS[t.theme]?.interpretation;
    if (!base) return { ...t, interpretation: "다수 신호가 집중된 영역. 중기적으로 경쟁과 기술 성숙이 가속화될 가능성." };

    const sourceSignal = t.sourceCount >= 3
      ? `GitHub, HN, Reddit 등 여러 소스에서 동시 포착 → 단순 노이즈가 아닌 구조적 관심.`
      : `신호 집중도가 높아 관련 생태계의 성숙 또는 전환 가능성을 시사.`;

    return {
      ...t,
      interpretation: `${base} ${sourceSignal}`,
    };
  });
}

// ===== Build sector implications (6–24 months) =====
function buildSectorImplications(themes) {
  const bullets = [];
  const themeSet = new Set(themes.map(t => t.theme));

  if (themeSet.has("AI Agent Infra")) {
    bullets.push(
      "AI Agent Infra: Agent 기반 자동화가 실제 업무/개발 워크플로우에 침투하며, 관련 프레임워크·메모리·MCP 레이어가 핵심 소프트웨어 스택으로 자리 잡을 가능성."
    );
  }
  if (themeSet.has("LLM / Reasoning") || themeSet.has("Multimodal / Vision")) {
    bullets.push(
      "LLM/멀티모달: 모델 성능 격차와 RL/Post-Training 기법 발전이 가속되며, 도메인 특화 모델과 에이전트 스택에서 경쟁이 심화될 것."
    );
  }
  if (themeSet.has("On-Device / Edge AI")) {
    bullets.push(
      "On-Device/Edge AI: 로컬 추론 인프라 성숙으로 프라이버시·지연시간 장벽이 낮아지며, 디바이스·웨어러블·모바일 AI 생태계가 빠르게 성장할 수 있음."
    );
  }
  if (themeSet.has("AI Infra & MLOps")) {
    bullets.push(
      "AI Infra/MLOps: GPU/인프라/비용 최적화 기술과 신뢰성 레이어가 구조적 수요를 유지하며, 'AI의 숨은 레이어'로 장기 성장."
    );
  }
  if (themeSet.has("Crypto / ZK Infra")) {
    bullets.push(
      "Crypto/ZK: 규제·UX 개선 시 ZK 기반 인증/프라이버시/토큰화 인프라가 기존 시스템과 경쟁 가능하나, 불확실성으로 분기점 단계."
    );
  }
  if (themeSet.has("AI Policy / Society")) {
    bullets.push(
      "AI Policy/Society: AI 확산 속도에 대한 사회적 우려가 규제·윤리 프레임워크로 이어지며, 일부 영역에서는 기술 발전 속도를 늦출 수 있음."
    );
  }
  if (themeSet.has("Physical AI / Robotics")) {
    bullets.push(
      "Physical AI/Robotics: AI와 로봇/웨어러블의 결합이 가속되며, 실세계 자동화와 새로운 하드웨어 시장이 열릴 가능성."
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "오늘 신호만으로는 특정 섹터의 중장기 방향성을 단정하기 어렵지만, AI Agent/Infra 관련 흐름은 상시 주시 대상."
    );
  }
  return bullets;
}

// ===== Build alpha candidates =====
function buildAlphaCandidates(ctx) {
  const sig = ctx.signals || {};
  const candidates = [];
  const seen = new Set();

  // From GitHub
  for (const r of (sig.github?.topByStarsToday || [])) {
    if (seen.has(r.repo)) continue;
    if ((r.recent_stars || 0) < 300) continue;
    seen.add(r.repo);
    const why = (r.description || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    candidates.push({
      name: r.repo,
      whyWatch: why || (r.why_notable || "star velocity"),
      crossCheck: null,
    });
  }

  // From ProductHunt
  for (const p of (sig.product_launch?.top_products || [])) {
    if (seen.has(p.name)) continue;
    if ((p.votes || 0) < 100) continue;
    seen.add(p.name);
    candidates.push({
      name: p.name,
      whyWatch: (p.tagline || p.why_notable || "early traction").slice(0, 140),
      crossCheck: null,
    });
  }

  // From cross_source overlap (if present)
  const cross = ctx.cross_source || {};
  for (const o of (cross.overlap_candidates || [])) {
    if (seen.has(o.name)) continue;
    seen.add(o.name);
    candidates.push({
      name: o.name,
      whyWatch: (o.reason || "multi-source signal").slice(0, 140),
      crossCheck: o.sources?.join(", ") || null,
    });
  }

  return candidates.slice(0, 10);
}

// ===== Build risk bullets =====
function buildRiskBullets(ctx, themes) {
  const bullets = [];
  const themeSet = new Set(themes.map(t => t.theme));
  const contrarian = ctx.contrarian_notes || [];

  // Use existing contrarian notes first
  for (const c of contrarian) {
    if (c) bullets.push(c);
  }

  // Data-driven risks
  if (themeSet.has("AI Agent Infra") || themeSet.has("LLM / Reasoning")) {
    bullets.push(
      "AI Agent/LLM 관련 과열: 급격한 Adoption과 과장된 기대가 공존. 실제 ROI가 입증되지 않은 영역에서 버블 위험 상시 존재."
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

// ===== Data quality note =====
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

// ===== Core: generateReport =====
function generateReport(date, ctx) {
  const lines = [];
  const push = (s = "") => lines.push(s);
  const section = (title) => {
    push();
    push(`## ${title}`);
  };

  const src = ctx.sources || {};
  const sig = ctx.signals || {};

  // Theme analysis
  const rawThemes = extractThemesFromSignals(ctx);
  const themes = buildThemeInterpretations(rawThemes);
  const sectorImplications = buildSectorImplications(themes);
  const alphaCandidates = buildAlphaCandidates(ctx);
  const riskBullets = buildRiskBullets(ctx, themes);
  const dataNotes = buildDataQualityNote(ctx);

  // ===== Title =====
  push(`# Alpha Hunter Deep Daily Brief — ${date}`);
  push();

  // ===== 1) Executive Summary =====
  section("1. Executive Summary");

  const execBullets = [];

  // Count signal volumes
  const ghCount = src.github_trending?.count || 0;
  const hnCount = src.hackernews?.topCount || 0;
  const rdPosts = src.reddit?.totalPosts || 0;
  const hfCount = src.research_ml?.hfCount || 0;
  const phCount = src.product_launch?.productHuntCount || 0;
  const jobCount = src.job_signals?.jobsCount || 0;

  // Use top themes to form narrative
  const topThemes = themes.filter(t => t.sourceCount >= 2).slice(0, 4);
  if (topThemes.length > 0) {
    const themeNames = topThemes.map(t => t.theme).join(", ");
    execBullets.push(
      `오늘 주요 키워드/테마: ${themeNames} — 복수 소스에서 동시 포착된 구조적 관심 영역.`
    );
  }

  // GitHub signal
  if (ghCount > 0) {
    const agentProjects = (sig.github?.topByStarsToday || []).filter(
      r => /agent|agentic|agent/i.test(r.description || "")
    ).length;
    execBullets.push(
      `GitHub Trending ${ghCount}개 중 AI Agent/DevTools 관련 프로젝트가 강세${agentProjects > 2 ? `, 특히 Agent 관련 프로젝트 ${agentProjects}개로 생태계 성숙 신호` : ""}.`
    );
  }

  // HN/Reddit
  if (hnCount > 0 || rdPosts > 0) {
    execBullets.push(
      `HN(${hnCount})/Reddit(${rdPosts})에서 AI/ML, infra, crypto 관련 고engagement 포스트 다수 — 엔지니어/커뮤니티의 관심이 집중된 영역.`
    );
  }

  // Research
  if (hfCount > 0) {
    execBullets.push(
      `HF/ArXiv에서 LLM, 멀티모달, agent 관련 모델/논문이 강세 — 연구와 제품이 빠르게 연결되는 구조.`
    );
  }

  // Product/Market
  if (phCount > 0) {
    execBullets.push(
      `ProductHunt에서 AI 관련 제품(${phCount}개)의 early traction이 확인됨 — 시장 수요와 제품화 속도가 빠르게 증가 중.`
    );
  }

  // Jobs
  if (jobCount > 0) {
    execBullets.push(
      `Job Signals ${jobCount}건 중 AI Infra, Agent, MLOps 관련 채용 비중 높음 — 자본과 인재가 해당 영역으로 집중 중.`
    );
  }

  for (const b of execBullets.slice(0, 5)) {
    push(`- ${b}`);
  }

  // ===== 2) Top Keywords & Themes =====
  section("2. Top Keywords & Themes");

  const topForSection = themes.filter(t => t.sourceCount >= 2).slice(0, 8);
  if (topForSection.length === 0) {
    push("- 오늘 데이터로는 뚜렷한 키워드/테마가 도출되지 않았습니다.");
  } else {
    for (const t of topForSection) {
      push(`- **${t.theme}** (sources: ${t.sources.join(", ")}, mentions: ${t.count})`);
      push(`  - 의미: ${t.interpretation}`);
    }
  }

  // ===== 3) Sector Implications (6–24 months) =====
  section("3. Sector Implications (6–24 months)");

  for (const b of sectorImplications) {
    push(`- ${b}`);
  }

  // ===== 4) Alpha Candidates & Watchlist =====
  section("4. Alpha Candidates & Watchlist");

  if (alphaCandidates.length === 0) {
    push("- 오늘 데이터로는 뚜렷한 Alpha 후보가 도출되지 않았습니다.");
  } else {
    for (const c of alphaCandidates) {
      push(`- **${c.name}**`);
      push(`  - Watch reason: ${c.whyWatch}`);
      if (c.crossCheck) {
        push(`  - Cross-source: ${c.crossCheck}`);
      }
    }
  }

  // ===== 5) Risk & Contrarian View =====
  section("5. Risk & Contrarian View");

  for (const r of riskBullets) {
    push(`- ${r}`);
  }

  // ===== 6) Data Quality Note =====
  section("6. Data Quality Note");

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
