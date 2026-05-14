// scripts/alpha_daily_report.mjs
// VC-grade daily brief generated from alpha_deep_context only.
// Output: reports/daily/YYYY-MM-DD.md
// Node 22+ built-in only. No npm installs.

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const REPORTS_DIR = path.join(PROJECT_ROOT, "reports", "daily");

function todayISODate() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return null; }
}

function esc(s) {
  if (typeof s !== "string") return "";
  return s.replace(/\*/g, "").replace(/_/g, "").replace(/`/g, "").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function generateReport(date, ctx) {
  const L = [];
  const push = (s = "") => L.push(s);
  const section = (num, title) => { push(); push(`## ${num}. ${title}`); };

  const src = ctx.sources || {};
  const clusters = ctx.keyword_clusters || [];
  const newTerms = ctx.new_terms || [];
  const crossSignals = ctx.cross_source_signals || [];
  const candidates = ctx.alpha_candidates || [];
  const sectorThemes = ctx.sector_themes || [];
  const contrarian = ctx.contrarian_notes || [];
  const sig = ctx.signals || {};

  // Count helpers
  const ghCount = src.github_trending?.count || 0;
  const hnCount = src.hackernews?.topCount || 0;
  const rdCount = src.reddit?.totalPosts || 0;
  const hfCount = src.research_ml?.hfCount || 0;
  const phCount = src.product_launch?.productHuntCount || 0;
  const jobCount = src.job_signals?.jobsCount || 0;

  // ===================== Title =====================
  push(`# Alpha Hunter Deep Daily Brief — ${date}`);
  push();
  push(`> GitHub ${ghCount} · HN ${hnCount} · Reddit ${rdCount} · HF ${hfCount} · PH ${phCount} · Jobs ${jobCount}`);

  // ===================== 1. Executive Summary =====================
  section(1, "Executive Summary");

  // Bullet 1: dominant themes
  if (clusters.length > 0) {
    const topThemes = clusters.slice(0, 3).map(c => c.name).join(", ");
    const totalSignals = clusters.reduce((s, c) => s + c.count, 0);
    push(`- 오늘 가장 강한 신호: **${topThemes}** — 총 ${totalSignals}개의 관련 키워드/멘션이 포착됨.`);
  }

  // Bullet 2: cross-source validation
  if (crossSignals.length > 0) {
    const strong = crossSignals.filter(s => s.strength === "strong").length;
    const moderate = crossSignals.filter(s => s.strength === "moderate").length;
    push(`- 복수 소스에서 교차 확인된 신호 ${crossSignals.length}건 (strong ${strong}, moderate ${moderate}). 단순 노이즈가 아닌 구조적 관심.`);
  }

  // Bullet 3: AI agent / infra narrative
  const agentCluster = clusters.find(c => c.name === "AI Agent Infra");
  if (agentCluster && agentCluster.count >= 15) {
    const sampleTerms = (agentCluster.sample_terms || []).slice(0, 4).join(", ");
    push(`- AI Agent Infra 클러스터가 ${agentCluster.count} 신호로 가장 큼. 대표 키워드: ${sampleTerms}. Agent 생태계는 단순 hype를 넘어 실제 infra 경쟁 단계.`);
  }

  // Bullet 4: coding/devtools
  const codingCluster = clusters.find(c => c.name === "AI Coding / DevTools");
  if (codingCluster && codingCluster.count >= 10) {
    push(`- AI Coding/DevTools 클러스터 ${codingCluster.count} 신호. AI-native 개발 환경 경쟁이 가속화되고 있음.`);
  }

  // Bullet 5: alpha candidates
  if (candidates.length > 0) {
    const top3 = candidates.slice(0, 3).map(c => c.name).join(", ");
    push(`- 오늘 Alpha Candidates ${candidates.length}건 중 주목할 만한 프로젝트/모델: ${top3}.`);
  }

  // ===================== 2. Keyword Clusters & New Terms =====================
  section(2, "Keyword Clusters & New Terms");

  // Keyword clusters
  push();
  push("**Keyword Clusters** — 각 클러스터는 실제 데이터에서 추출한 키워드 빈도 기반.");
  push();
  for (const c of clusters) {
    push(`- **${c.name}** (count: ${c.count})`);
    const terms = (c.sample_terms || []).slice(0, 6).join(", ");
    if (terms) push(`  - 관련 키워드: ${terms}`);
  }

  // New terms
  if (newTerms.length > 0) {
    push();
    push("**New Terms** — 복수 소스에서 부상하는 개념.");
    push();
    for (const t of newTerms) {
      push(`- **${t.term}** (count: ${t.count}, sources: ${t.sources.join(", ") || "—"})`);
      if (t.definition_hint) push(`  - 정의: ${t.definition_hint}`);
      if (t.why_interesting) push(`  - 주목 이유: ${t.why_interesting}`);
    }
  }

  // ===================== 3. Cross-Source Signals =====================
  section(3, "Cross-Source Signals");

  if (crossSignals.length === 0) {
    push("- 오늘 데이터로는 복수 소스에서 교차 확인된 명확한 신호가 부족합니다.");
  } else {
    for (const s of crossSignals) {
      push(`- **${s.name}** — strength: ${s.strength}, sources: ${s.sources.join(", ")} (count: ${s.count})`);
      if (s.summary) push(`  - ${s.summary}`);
    }
  }

  // ===================== 4. Alpha Candidates =====================
  section(4, "Alpha Candidates");

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

      push(`- **${name}** (${type}, ${sources})`);
      push(`  - Why watch: ${thesis}`);
      if (risks) push(`  - Risk: ${risks}`);
      if (themes) push(`  - Themes: ${themes}`);
    }
  }

  // ===================== 5. Sector Outlook (6-24 months) =====================
  section(5, "Sector Outlook (6-24 months)");

  if (sectorThemes.length === 0) {
    push("- 오늘 데이터로는 섹터 전망을 도출하기 부족합니다.");
  } else {
    for (const t of sectorThemes) {
      push(`- **${t.name}** (count: ${t.count})`);
      if (t.outlook) push(`  - ${t.outlook}`);
    }
  }

  // ===================== 6. Risk & Contrarian View =====================
  section(6, "Risk & Contrarian View");

  for (const c of contrarian) {
    push(`- ${c}`);
  }

  // ===================== 7. Data Quality Note =====================
  section(7, "Data Quality Note");

  const notes = [];
  if (!src.github_trending?.valid) notes.push("GitHub Trending: 데이터 수집 실패 또는 불안정.");
  if (!src.hackernews?.valid) notes.push("HN: 데이터 수집 실패 또는 불안정.");
  if (!src.reddit?.valid) notes.push("Reddit: 유효 포스트가 거의 없거나 수집 실패.");
  if (!src.research_ml?.valid) notes.push("Research ML (HF/ArXiv): 데이터가 거의 없거나 수집 실패.");
  if (!src.product_launch?.valid) notes.push("ProductHunt: 데이터가 거의 없거나 수집 실패.");
  if (!src.job_signals?.valid) notes.push("Job Signals: 데이터가 거의 없거나 수집 실패.");

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
  console.log(`[alpha_report] Generating VC-grade daily report for ${date}`);

  const deepCtxFile = path.join(DATA_DIR, `alpha_deep_context_${date}.json`);
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

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const reportPath = path.join(REPORTS_DIR, `${date}.md`);

  try {
    const md = generateReport(date, ctx);
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
