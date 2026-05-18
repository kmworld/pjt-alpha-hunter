// scripts/alpha_deep_context.mjs
// Core intelligence hub for Alpha Hunter.
// Aggregates all data sources, clusters keywords, detects new terms,
// cross-validates signals, and produces structured alpha candidates.
// Output: data/alpha_deep_context_<YYYY-MM-DD>.json

import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

function todayISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch { return null; }
}

// ===================== STOP WORDS =====================

const STOP = new Set([
  "ai","machine learning","deep learning","model","data","cloud","tech","technology",
  "open source","software","tool","tools","platform","framework","library","sdk","api",
  "app","application","web","mobile","server","service","services","system","systems",
  "new","best","fast","fastest","next","next-gen","next generation","powerful",
  "revolutionary","disruptive","game-changing","cutting-edge","state-of-the-art",
  "based","using","with","for","in","on","the","and","or","but","to","of","is",
  "it","its","this","that","these","those","a","an","by","from","at","as","so",
  "can","will","would","could","should","may","might","must","shall","not",
  "about","into","through","during","before","after","above","below","between",
  "also","very","really","just","more","most","much","many","some","any",
  "here","there","where","when","how","what","who","which","why",
  "like","such","even","still","yet","already","now","today","tomorrow",
  "really","actually","basically","simply","truly","highly","fully","completely",
  "build","built","building","make","made","making","create","created","creating",
  "help","helps","helping","enable","enables","enabled","enabling",
  "use","uses","used","using","provide","provides","provided","providing",
  "support","supports","supported","supporting","allow","allows","allowed","allowing",
  "great","awesome","amazing","cool","nice","good","excellent","fantastic",
  "improve","improved","improving","better","faster","easier",
  "solution","solutions","innovation","innovations","approach","approaches",
  "way","ways","method","methods","process","processes",
  "set","set up","sets","setting","settings",
]);

// ===================== THEME TAXONOMY =====================

const THEME_TAXONOMY = {
  "AI Agent Infra": ["agent","agents","agentic","multi-agent","autonomous agent","agent memory","agent tool","agent framework","agent platform","agent stack"],
  "LLM / Reasoning": ["llm","llms","large language model","reasoning","grpo","rlhf","ppo","chain-of-thought","speculative decoding"],
  "AI Coding / DevTools": ["code","coding","codegen","code generation","ide","devtools","developer tools","vibe coding","ai coding agent"],
  "Multimodal": ["multimodal","vision-language","vlm","image-gen","image generation","video","text-to-image","audio","speech"],
  "On-Device AI": ["on-device","edge ai","gguf","quantize","quantized","local inference","on-device ai"],
  "Crypto / ZK": ["crypto","blockchain","zk","zk-snark","zk-stark","zk-rollup","zero-knowledge","defi","web3","token","nft","dao","dex","l2"],
  "MLOps / Infra": ["mlops","infra","infrastructure","gpu","training","inference","kubernetes","cloud infra","observability","telemetry"],
  "Physical AI": ["robot","robotics","embodied","physical ai","actuator","locomotion"],
  "Security": ["security","vulnerability","exploit","adversarial","prompt injection","privacy","safety"],
  "AI Policy": ["regulation","policy","ai act","ban","ai safety","ai alignment","ai ethics"],
};

function classifyTheme(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const themes = [];
  for (const [theme, kws] of Object.entries(THEME_TAXONOMY)) {
    if (kws.some(k => t.includes(k))) themes.push(theme);
  }
  return themes;
}

// ===================== KEYWORD EXTRACTION =====================

function tokenize(text) {
  if (!text) return [];
  const t = text.toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\-_.\s]/g, " ")
    .trim();
  const tokens = t.split(/\s+/).filter(w => w.length > 2);
  return tokens.filter(w => !STOP.has(w));
}

function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i + 1 < tokens.length; i++) {
    const b = tokens[i] + " " + tokens[i+1];
    if (!STOP.has(b) && b.split(" ").every(w => w.length > 2)) {
      bigrams.push(b);
    }
  }
  return bigrams;
}

function collectAllTokens(ctx) {
  const tokens = [];
  const bigrams = [];

  const add = (text) => {
    const t = tokenize(text);
    tokens.push(...t);
    bigrams.push(...extractBigrams(t));
  };

  // GitHub (raw content only)
  (ctx.signals?.github?.topByStarsToday || []).forEach(r => {
    add(`${r.repo} ${r.description} ${(r.topics||[]).join(" ")}`);
  });

  // HN (titles only)
  (ctx.signals?.hackernews?.topByEngagement || []).forEach(h => add(h.title));
  (ctx.signals?.hackernews?.show_hn_high_signal || []).forEach(h => add(h.title));

  // Reddit: hot topics + actual post titles/summaries
  (ctx.signals?.reddit?.hot_topics || []).forEach(t => {
    add(t.topic);
    (t.sample_titles || []).forEach(tt => add(tt));
  });
  // Also ingest all top posts' titles and summaries for keyword clustering, cross-source signals, entities
  (ctx.signals?.reddit?.topPosts || []).forEach(p => {
    add(`${p.title} ${(p.post_summary || "")}`);
  });

  // Research ML (model id + tags only; no generated why_notable)
  (ctx.signals?.research_ml?.trending_models || []).forEach(m => {
    add(`${m.id} ${(m.tags||[]).join(" ")}`);
  });
  // Papers: title + abstract (raw)
  (ctx.signals?.research_ml?.notable_papers || []).forEach(p => {
    add(`${p.title} ${p.abstract_short}`);
  });

  // Product Launch (name + tagline only)
  (ctx.signals?.product_launch?.top_products || []).forEach(p => {
    add(`${p.name} ${p.tagline}`);
  });

  // Jobs (role title only)
  (ctx.signals?.jobs?.emerging_roles || []).forEach(r => {
    add(r.role);
  });

  return { tokens, bigrams };
}

function countFrequencies(items) {
  const freq = {};
  for (const item of items) {
    freq[item] = (freq[item] || 0) + 1;
  }
  return freq;
}

// ===================== KEYWORD CLUSTERING =====================

function buildKeywordClusters(ctx) {
  const { tokens, bigrams } = collectAllTokens(ctx);
  const tokenFreq = countFrequencies(tokens);
  const bigramFreq = countFrequencies(bigrams);

  // Merge bigrams that are strong into tokens
  for (const [bigram, count] of Object.entries(bigramFreq)) {
    if (count >= 3) {
      tokenFreq[bigram] = (tokenFreq[bigram] || 0) + count;
    }
  }

  // Classify each keyword into theme(s)
  const keywordThemes = {};
  for (const kw of Object.keys(tokenFreq)) {
    keywordThemes[kw] = classifyTheme(kw);
  }

  // Build clusters
  const clusters = {};
  for (const [theme] of Object.entries(THEME_TAXONOMY)) {
    clusters[theme] = { count: 0, sample_terms: [] };
  }

  // Assign keywords to clusters by theme
  const sortedKws = Object.entries(tokenFreq)
    .filter(([,c]) => c >= 2)
    .sort((a,b) => b[1] - a[1]);

  for (const [kw, count] of sortedKws) {
    const themes = keywordThemes[kw] || [];
    if (themes.length === 0) continue;
    for (const theme of themes) {
      if (!clusters[theme]) continue;
      clusters[theme].count += count;
      if (clusters[theme].sample_terms.length < 10) {
        clusters[theme].sample_terms.push(`${kw}(${count})`);
      }
    }
  }

  // Remove empty clusters
  const result = [];
  for (const [theme, data] of Object.entries(clusters)) {
    if (data.count === 0) continue;
    result.push({
      name: theme,
      count: data.count,
      sample_terms: data.sample_terms,
    });
  }
  return result.sort((a,b) => b.count - a.count);
}

// ===================== NEW TERM DETECTION =====================

function detectNewTerms(ctx) {
  const { tokens, bigrams } = collectAllTokens(ctx);
  const bigramFreq = countFrequencies(bigrams);

  const GENERIC_BIGRAMS = new Set([
    "ai agent","machine learning","deep learning","large language",
    "open source","code generation","state of the art",
    "artificial intelligence","natural language","cloud computing",
    "blockchain technology","data science","software development",
    "web application","mobile app","user interface",
    "user experience","real time","high performance",
    "end to end","full stack","micro service",
    "emerging role","strong early","early interest","high likes",
    "high traction","engineer emerging","conversational text-generation",
    "multiple postings","strong demand","emerging role with niche demand",
    "notable product launch with votes/interest",
  ]);

  // Candidate new terms: bigrams with decent frequency, non-generic
  const candidates = Object.entries(bigramFreq)
    .filter(([,c]) => c >= 2)
    .map(([term, count]) => ({ term, count }))
    .filter(({ term }) => {
      const t = term.toLowerCase();
      if (GENERIC_BIGRAMS.has(t)) return false;
      if (t.length < 6 || t.length > 50) return false;
      // Must contain at least one "meaningful" token (not pure noise)
      const hasSignal = ["agent","ai","llm","code","crypto","zk","infra",
                         "robot","model","infra","mcp","embed","reason",
                         "multimodal","vision","on-device","edge","quantiz",
                         "agent","memory","tool","stack","framework",
                         "platform","runtime","protocol","runtime","sandbox",
                         "vibe","spec","agentic","autonom"].some(k => t.includes(k));
      if (!hasSignal) return false;
      return true;
    });

  // For each candidate, check cross-source presence
  const result = [];
  for (const { term, count } of candidates) {
    const sources = findTermSources(ctx, term);
    if (sources.length < 2 && count < 4) continue;

    const definitionHint = inferDefinition(term);
    const whyInteresting = inferWhyInteresting(term, count, sources);

    result.push({
      term,
      count,
      sources,
      definition_hint: definitionHint,
      why_interesting: whyInteresting,
    });
  }

  return result
    .sort((a,b) => b.count - a.count || b.sources.length - a.sources.length)
    .slice(0, 8);
}

function findTermSources(ctx, term) {
  const t = term.toLowerCase();
  const sources = [];

  if ((ctx.signals?.github?.topByStarsToday || []).some(r =>
      `${r.repo} ${r.description}`.toLowerCase().includes(t))) {
    sources.push("github");
  }
  if ((ctx.signals?.hackernews?.topByEngagement || []).some(h =>
      (h.title || "").toLowerCase().includes(t)) ||
      (ctx.signals?.hackernews?.show_hn_high_signal || []).some(h =>
      (h.title || "").toLowerCase().includes(t))) {
    sources.push("hn");
  }
  // Check reddit: hot topics + actual posts
  if ((ctx.signals?.reddit?.hot_topics || []).some(top =>
      top.topic.toLowerCase().includes(t) ||
      (top.sample_titles || []).some(tt => tt.toLowerCase().includes(t))) ||
      (ctx.signals?.reddit?.topPosts || []).some(p =>
        `${p.title} ${(p.post_summary || "")}`.toLowerCase().includes(t))) {
    sources.push("reddit");
  }
  if ((ctx.signals?.research_ml?.trending_models || []).some(m =>
      `${m.id} ${(m.tags||[]).join(" ")}`.toLowerCase().includes(t))) {
    sources.push("hf");
  }
  if ((ctx.signals?.product_launch?.top_products || []).some(p =>
      `${p.name} ${p.tagline}`.toLowerCase().includes(t))) {
    sources.push("product_hunt");
  }
  if ((ctx.signals?.jobs?.emerging_roles || []).some(r =>
      (r.role || "").toLowerCase().includes(t))) {
    sources.push("jobs");
  }
  return sources;
}

function inferDefinition(term) {
  const t = term.toLowerCase();
  if (t.includes("vibe coding")) return "Low-code/no-code style development guided by AI based on intuition.";
  if (t.includes("agentic")) return "Systems where AI agents autonomously perform multi-step tasks.";
  if (t.includes("agent memory")) return "Persistent memory layers enabling agents to retain context across sessions.";
  if (t.includes("on-device")) return "AI models running locally on user hardware instead of cloud.";
  if (t.includes("multimodal")) return "Models that process multiple input types (text, image, audio, video).";
  if (t.includes("reasoning")) return "LLM capabilities for multi-step logical inference.";
  if (t.includes("spec-driven")) return "Development driven by formal specifications validated by AI.";
  if (t.includes("physical ai")) return "AI integrated with physical systems (robots, sensors, actuators).";
  if (t.includes("mcp")) return "Protocol for connecting AI agents to external tools and data.";
  if (t.includes("zk")) return "Zero-knowledge cryptography for privacy-preserving computation.";
  return `Emerging concept around "${term}" detected across multiple sources.`;
}

function inferWhyInteresting(term, count, sources) {
  const t = term.toLowerCase();
  if (sources.length >= 3) {
    return `Strong cross-source signal (${sources.join(", ")}); potential paradigm shift if sustained.`;
  }
  if (t.includes("vibe coding") || t.includes("agentic")) {
    return "Directly impacts how developers and organizations will use AI in the next 12-24 months.";
  }
  if (count >= 5) {
    return `High frequency (${count}); emerging consensus around this concept.`;
  }
  return `Rising concept with ${count} mentions; early signal worth tracking.`;
}

// ===================== CROSS-SOURCE SIGNALS =====================

function buildCrossSourceSignals(ctx) {
  // Collect all named entities (projects, tools, models, themes)
  const entityMap = new Map(); // entity -> { sources, mentions, context }

  function addEntity(name, source, context) {
    if (!name || name.length < 3) return;
    const key = name.toLowerCase().trim();
    if (!entityMap.has(key)) {
      entityMap.set(key, { name, sources: new Set(), count: 0, contexts: [] });
    }
    const e = entityMap.get(key);
    e.sources.add(source);
    e.count++;
    if (e.contexts.length < 3) e.contexts.push(context);
  }

  // From GitHub: repo names with high stars
  (ctx.signals?.github?.topByStarsToday || []).forEach(r => {
    const repoName = (r.repo || "").split("/").pop();
    if (repoName && (r.recent_stars || 0) >= 100) {
      addEntity(repoName, "github", `${r.recent_stars} stars today; ${r.description?.slice(0, 60) || ""}`);
    }
  });

  // From HN: project names from titles
  (ctx.signals?.hackernews?.topByEngagement || []).forEach(h => {
    const title = h.title || "";
    const project = extractProjectName(title);
    if (project && h.score >= 30) {
      addEntity(project, "hn", `HN score ${h.score}; ${title.slice(0, 60)}`);
    }
  });
  (ctx.signals?.hackernews?.show_hn_high_signal || []).forEach(h => {
    const project = extractProjectName(h.title || "");
    if (project) {
      addEntity(project, "hn", `Show HN; score ${h.score}`);
    }
  });

  // From Reddit: topics with high engagement
  (ctx.signals?.reddit?.hot_topics || []).forEach(t => {
    if (t.topic && t.topic.length > 3) {
      addEntity(t.topic, "reddit", `${t.sample_titles?.length || 0} posts; ${t.why_important?.slice(0, 60) || ""}`);
    }
  });

  // From HF: model names
  (ctx.signals?.research_ml?.trending_models || []).forEach(m => {
    if (m.id && (m.likes || 0) >= 100) {
      addEntity(m.id.split("/").pop(), "hf", `HF likes: ${m.likes}; ${m.why_notable?.slice(0, 60) || ""}`);
    }
  });

  // From Product Hunt: product names
  (ctx.signals?.product_launch?.top_products || []).forEach(p => {
    if (p.name && (p.votes || 0) >= 20) {
      addEntity(p.name, "product_hunt", `${p.votes || 0} votes; ${p.tagline?.slice(0, 60) || ""}`);
    }
  });

  // From Jobs: role names
  (ctx.signals?.jobs?.emerging_roles || []).forEach(r => {
    if (r.role && r.count >= 2) {
      addEntity(r.role, "jobs", `${r.count} postings; ${r.why_signal?.slice(0, 60) || ""}`);
    }
  });

  // Filter: only entities appearing in 2+ sources
  const signals = [];
  for (const [, e] of entityMap) {
    const srcArr = e.sources instanceof Set ? [...e.sources] : e.sources;
    if (srcArr.length < 2) continue;
    const strength = srcArr.length >= 3 ? "strong" : "moderate";
    const summary = inferCrossSourceSummary(e);
    signals.push({
      name: e.name,
      sources: srcArr,
      strength,
      count: e.count,
      summary,
    });
  }

  return signals
    .sort((a,b) => b.sources.size - a.sources.size || b.count - a.count)
    .slice(0, 10);
}

function extractProjectName(title) {
  const cleaned = title
    .replace(/^(Show HN|HN:|New:|Launch|Announcing|Introducing|Building|Presenting)\s*[:\-–]\s*/i, "")
    .replace(/^(I built|We built|We launched|We're building)\s+/i, "")
    .split(" - ")
    .pop()
    .trim();
  // Take first meaningful chunk
  const parts = cleaned.split(" ").slice(0, 6).join(" ");
  return parts.length > 3 ? parts : null;
}

function inferCrossSourceSummary(entity) {
  const srcArr = entity.sources instanceof Set ? [...entity.sources] : entity.sources;
  const srcCount = srcArr.length;
  const srcNames = srcArr.join(", ");
  if (srcCount >= 3) {
    return `Confirmed across ${srcCount} sources (${srcNames}). Not mere noise — structural interest in this area.`;
  }
  return `Appears in ${srcNames}; early cross-validation signal. Worth monitoring for momentum.`;
}

// ===================== ALPHA CANDIDATES =====================

function buildAlphaCandidates(ctx) {
  const candidates = [];

  // Score all potential candidates from each source
  const pool = [];

  // GitHub: high star velocity + AI-relevant
  (ctx.signals?.github?.topByStarsToday || []).forEach(r => {
    if ((r.recent_stars || 0) < 100) return;
    const themes = classifyTheme(`${r.description} ${(r.topics||[]).join(" ")}`);
    const score = (r.recent_stars || 0) / 50 + themes.length * 3;
    pool.push({
      name: r.repo,
      type: "project",
      sources: ["github"],
      score,
      themes,
      detail: `${r.description?.slice(0, 120) || ""} — ${r.recent_stars} stars today`,
    });
  });

  // HN Show HN: tools with real engagement
  (ctx.signals?.hackernews?.show_hn_high_signal || []).forEach(h => {
    if (h.score < 20) return;
    const themes = classifyTheme(h.title);
    const score = (h.score + h.comments * 0.5) / 15 + themes.length * 2;
    pool.push({
      name: h.title.split(" - ").pop().trim().slice(0, 60),
      type: "project",
      sources: ["hn"],
      score,
      themes,
      detail: `Show HN with ${h.score} upvotes, ${h.comments} comments`,
    });
  });

  // HF: high-likes models
  (ctx.signals?.research_ml?.trending_models || []).forEach(m => {
    if ((m.likes || 0) < 200) return;
    const themes = classifyTheme(`${m.id} ${(m.tags||[]).join(" ")}`);
    const score = (m.likes || 0) / 100 + themes.length * 2;
    pool.push({
      name: m.id,
      type: "model",
      sources: ["hf"],
      score,
      themes,
      detail: `HF likes: ${m.likes}; ${m.why_notable?.slice(0, 100) || ""}`,
    });
  });

  // Product Hunt: AI products with traction
  (ctx.signals?.product_launch?.top_products || []).forEach(p => {
    if ((p.votes || 0) < 30) return;
    const themes = classifyTheme(`${p.name} ${p.tagline}`);
    const score = (p.votes || 0) / 20 + themes.length * 2;
    pool.push({
      name: p.name,
      type: "startup",
      sources: ["product_hunt"],
      score,
      themes,
      detail: `${p.votes || 0} votes; ${p.tagline?.slice(0, 80) || ""}`,
    });
  });

  // Jobs: emerging roles (as trend signals)
  (ctx.signals?.jobs?.emerging_roles || []).forEach(r => {
    if (r.count < 2) return;
    const themes = classifyTheme(r.role);
    const score = r.count * 2 + themes.length * 2;
    pool.push({
      name: r.role,
      type: "trend",
      sources: ["jobs"],
      score,
      themes,
      detail: `${r.count} postings; ${r.why_signal?.slice(0, 80) || ""}`,
    });
  });

  // Cross-source: boost candidates appearing in multiple sources
  const crossSignals = buildCrossSourceSignals(ctx);
  const crossSet = new Set(crossSignals.map(s => s.name.toLowerCase()));
  for (const c of pool) {
    if (crossSet.has(c.name.toLowerCase())) {
      c.sources.push("cross-validated");
      c.score += 5;
    }
  }

  // Sort and pick top
  pool.sort((a,b) => b.score - a.score);
  const selected = pool.slice(0, 15);

  // Enrich each with thesis + risk
  for (const c of selected) {
    c.alpha_thesis = buildAlphaThesis(c);
    c.risk = buildRisk(c);
    c.sector_themes = c.themes.slice(0, 4);
    delete c.score;
    delete c.themes;
    delete c.detail;
  }

  return selected.slice(0, 10);
}

function buildAlphaThesis(c) {
  const name = (c.name || "").toLowerCase();
  const themes = c.themes || [];
  const sources = c.sources || [];
  const detail = (c.detail || "").toLowerCase();

  // --- Known models: custom thesis ---
  if (name.includes("deepseek-r1")) {
    return "DeepSeek-R1는 reasoning 모델로서 open-source 생태계에서 가장 영향력 있는 모델 중 하나. 기업과 연구팀이 실제 agent/agent infra 구축에 이 모델을 backbone으로 채택하고 있음. 6-12개월 내 파생 모델과 fine-tune이 폭발적으로 증가할 것으로 예상.";
  }
  if (name.includes("flux.1-dev")) {
    return "FLUX.1-dev는 이미지 생성 모델 중 현재 가장 높은 community likes를 기록 중. Stable Diffusion 이후 가장 의미 있는 open-weight image model. 12개월 내 AI-native 디자인/마케팅 워크플로우의 표준 backbone이 될 가능성이 높음.";
  }
  if (name.includes("stable-diffusion-xl")) {
    return "SDXL은 이미 production-ready이며 수많은 파생 모델의 base. 단기 alpha는 아니지만, 새로운 fine-tune/adapter 프로젝트가 이 모델을 기반으로 나올 때마다 watch할 필요가 있음.";
  }
  if (name.includes("whisper-large-v3")) {
    return "Whisper-large-v3는 speech-to-text의 de facto 표준. AI voice agent, real-time transcription, accessibility tooling 등 다양한 영역에서 backbone으로 사용 중. 12-24개월 내 voice-first AI UX의 핵심 인프라.";
  }
  if (name.includes("kokoro")) {
    return "Kokoro는 lightweight TTS 모델로, on-device voice agent의 실현 가능성을 높이는 모델. 82M 파라미터로 실시간 추론이 가능하여, edge AI + voice agent 시나리오에서 중요한 변수.";
  }
  if (name.includes("meta-llama-3-8b")) {
    return "Meta-Llama-3-8B는 open-source LLM 중 가장 널리 쓰이는 backbone 중 하나. Agent infra, RAG, fine-tuning ecosystem이 이 모델 주위에 집중되어 있음. 단기 alpha는 아니지만, 파생 프로젝트 watch의 기준점.";
  }
  if (name.includes("llama-3.1-8b")) {
    return "Llama-3.1-8B-Instruct는 instruction-tuned variant로, agent tool-calling과 RAG 파이프라인에서 널리 사용 중. 실제 production agent의 backbone으로서 영향력이 큼.";
  }

  // --- Known projects: custom thesis ---
  if (name.includes("openhuman")) {
    return "openhuman은 'personal AI super intelligence'를 목표로 하는 프로젝트. Rust 기반으로 privacy-first 접근. 개인 AI agent가 on-device에서 실행되는 시나리오에서 중요한 후보. 12-24개월 내 개인 agent 생태계에서 주목할 프로젝트.";
  }
  if (name.includes("skills") && name.includes("mattpocock")) {
    return "skills는 agentic skills/framework 관련 프로젝트. AI agent가 외부 tool과 연동되는 방식에서 중요한 변수. MCP(Model Context Protocol)나 agent tooling 생태계와 직결.";
  }

  // --- Generic but differentiated by themes ---
  if (c.type === "model") {
    if (themes.includes("LLM / Reasoning")) {
      return `Reasoning/LLM 모델로, agent infra와 RAG 파이프라인에서 backbone으로 사용 가능. 6-12개월 내 파생 fine-tune과 agent 프로젝트가 이 모델을 기반으로 등장할 것으로 예상.`;
    }
    if (themes.includes("Multimodal")) {
      return `Multimodal 모델로서, AI-native UX(voice, vision, video)의 backbone이 될 수 있음. Latency와 cost가 개선되면, 실제 production agent에 채택될 가능성이 높음.`;
    }
    return `Research-grade 모델. 실제 alpha는 이 모델을 기반으로 하는 파생 프로젝트에서 나옴. 12개월 내 ecosystem forks를 watch.`;
  }

  if (c.type === "project") {
    if (themes.includes("AI Agent Infra")) {
      return `Agent infra 프로젝트. 실제 autonomous workflow의 building block이 될 수 있음. 6-18개월 내 developer adoption과 ecosystem integration을 watch.`;
    }
    if (themes.includes("AI Coding / DevTools")) {
      return `AI coding/devtools 프로젝트. AI-native 개발 환경 경쟁에서 early mover advantage가 중요. 12개월 내 실제 팀 사용량을 watch.`;
    }
    return `Early-stage 프로젝트. ${sources.join(", ")}에서 강한 초기 신호. 12-24개월 내 niche에서 영향력을 가질 수 있음. 핵심 지표: developer adoption.`;
  }

  if (c.type === "trend") {
    return `Labor-market signal: 이 역할에 대한 채용 수요가 증가 중. AI/infra 팀 구성의 구조적 변화를 반영. 관련 tooling과 training ecosystem이 12-24개월 내 확장될 것으로 예상.`;
  }

  return `Emerging signal across ${sources.join(", ")}. 아직 강한 thesis를 세우기엔 부족하지만, watch할 만한 초기 신호.`;
}

function buildRisk(c) {
  const risks = [];
  const themes = c.themes || [];

  if (themes.includes("AI Agent Infra") || themes.includes("LLM / Reasoning")) {
    risks.push("AI agent hype cycle; many similar tools competing with unclear differentiation.");
  }
  if (themes.includes("Crypto / ZK")) {
    risks.push("Regulatory uncertainty across major jurisdictions; market cycles can rapidly reduce interest.");
  }
  if (c.type === "project" && c.sources.length === 1) {
    risks.push("Single-source signal; needs cross-validation to confirm real momentum.");
  }
  if (c.type === "model") {
    risks.push("Research-to-production gap; may not scale outside controlled environments.");
  }
  if (c.type === "trend") {
    risks.push("Short-term hiring spike may not reflect long-term structural demand.");
  }
  if (risks.length === 0) {
    risks.push("Limited information; early-stage signal without strong validation.");
  }
  return risks.slice(0, 3);
}

// ===================== SECTOR THEMES =====================

function buildSectorThemes(ctx) {
  const clusters = buildKeywordClusters(ctx);
  const themes = [];

  const outlookMap = {
    "AI Agent Infra": "Agent infra is transitioning from demos to production; expect consolidation around 3-5 key frameworks by 2027.",
    "LLM / Reasoning": "Reasoning models are becoming the new battleground; companies betting on superior reasoning will capture enterprise demand.",
    "AI Coding / DevTools": "AI-native devtools will reshape how 80% of code is written within 3 years. Early movers have a distribution moat.",
    "Multimodal": "Multimodal models are no longer 'nice to have' — they're becoming the default for any serious AI product.",
    "On-Device AI": "On-device AI is the next infra wave; privacy, latency, and cost make it structurally attractive beyond early adopters.",
    "Crypto / ZK": "ZK and crypto infra are regaining attention; long-term viability depends on regulatory clarity and real-world use cases.",
    "MLOps / Infra": "AI infra is becoming the bottleneck — companies that solve training/inference efficiency will be acquired or go public.",
    "Physical AI": "Physical AI is moving from research to pilot deployments; robotics + AI convergence is accelerating.",
    "Security": "AI security is becoming a standalone category; prompt injection, data leaks, and model attacks are real business risks.",
    "AI Policy": "Regulatory frameworks are maturing; companies without compliance-ready AI will face existential risk.",
  };

  for (const cluster of clusters) {
    if (cluster.count < 3) continue;
    themes.push({
      name: cluster.name,
      count: cluster.count,
      sources: 2, // simplified; real impl would track per-source
      outlook: outlookMap[cluster.name] || `Growing theme with ${cluster.count} signals; structural interest likely to continue.`,
    });
  }

  return themes.sort((a,b) => b.count - a.count).slice(0, 8);
}

// ===================== CONTRARIAN NOTES =====================

function buildContrarianNotes(ctx) {
  const notes = [];
  const clusters = buildKeywordClusters(ctx);
  const agentHeat = clusters.find(c => c.name === "AI Agent Infra")?.count || 0;
  const llmHeat = clusters.find(c => c.name === "LLM / Reasoning")?.count || 0;
  const codingHeat = clusters.find(c => c.name === "AI Coding / DevTools")?.count || 0;

  if (agentHeat + llmHeat >= 10) {
    notes.push(
      "AI Agent hype vs reality: Most 'agentic' projects are glorified chatbots with tool calling. True autonomy (multi-step, self-correcting, distributed) is rare. Investors should stress-test every agent claim."
    );
  }

  if (codingHeat >= 5) {
    notes.push(
      "AI coding tools: Everyone claims '10x developer' but most are autocomplete on steroids. The real alpha is in team-level workflows, not individual speedups."
    );
  }

  const jobs = ctx.signals?.jobs?.emerging_roles || [];
  const aiRoles = jobs.filter(r => /ai|ml|agent/i.test(r.role || "")).length;
  if (aiRoles >= 5) {
    notes.push(
      "AI hiring fever: Many companies are hiring 'AI engineers' without clear use cases. This is a bubble risk — roles without real product-market fit will be cut first."
    );
  }

  const cryptoHeat = clusters.find(c => c.name === "Crypto / ZK")?.count || 0;
  if (cryptoHeat >= 3) {
    notes.push(
      "Crypto/ZK narratives are regaining attention, but regulatory and UX friction remain unsolved. Most ZK projects are technically impressive but commercially unproven."
    );
  }

  if (notes.length === 0) {
    notes.push(
      "Today's signals are broadly aligned; no strong contrarian angle yet. Watch for divergence over the next few days."
    );
  }

  return notes.slice(0, 4);
}

// ===================== MAIN =====================

function buildDeepContext(date) {
  const dateDir = path.join(DATA_DIR, date);
  const gh = safeReadJSON(path.join(dateDir, `github_trending.json`));
  const hn = safeReadJSON(path.join(dateDir, `hackernews.json`));
  const reddit = safeReadJSON(path.join(dateDir, `reddit.json`));
  const research = safeReadJSON(path.join(dateDir, `research_ml.json`));
  const product = safeReadJSON(path.join(dateDir, `product_launch.json`));
  const jobs = safeReadJSON(path.join(dateDir, `job_signals.json`));

  // Pass raw signals through (report uses them)
  const rawSignals = {
    github: {
      topByStarsToday: (gh?.items || [])
        .sort((a,b) => (b.recent_stars||0) - (a.recent_stars||0))
        .slice(0, 20)
        .map(r => ({
          repo: r.repo,
          description: (r.description || "").slice(0, 160),
          language: r.language || null,
          stars: r.stars || null,
          recent_stars: r.recent_stars || null,
          url: r.url,
          topics: r.topics || [],
          why_notable: (r.why_notable || "").slice(0, 120),
        })),
    },
    hackernews: {
      topByEngagement: (hn?.sections?.top || [])
        .sort((a,b) => (b.score + b.comments*0.3) - (a.score + a.comments*0.3))
        .slice(0, 15)
        .map(h => ({
          title: h.title,
          url: h.url || null,
          score: h.score,
          comments: h.comments,
          why_hot: (h.why_hot || "").slice(0, 100),
        })),
      show_hn_high_signal: (hn?.sections?.show_hn || [])
        .sort((a,b) => (b.score + b.comments*0.4) - (a.score + a.comments*0.4))
        .filter(s => (s.score||0) >= 20)
        .slice(0, 10)
        .map(h => ({
          title: h.title,
          url: h.url || null,
          score: h.score,
          comments: h.comments,
        })),
    },
    reddit: {
      hot_topics: (reddit?.hot_subreddits || [])
        .slice(0, 8)
        .map(s => ({
          topic: s.name,
          subreddits: [s.name],
          sample_titles: (s.sample_titles || []).slice(0, 4),
          why_important: `${s.post_count || 0} posts; active discussion.`,
        })),
      topPosts: ((reddit?.global_hot_posts || [])
        .sort((a,b) => (b.score + b.comments*0.2) - (a.score + a.comments*0.2))
        .slice(0, 25)
        .map(p => ({
          title: p.title,
          url: p.url || null,
          score: p.score,
          comments: p.comments,
          subreddit: p.subreddit || null,
          post_summary: (p.post_summary || "").slice(0, 200),
        }))),
    },
    research_ml: {
      trending_models: (research?.huggingface_trending || [])
        .sort((a,b) => (b.likes||0) - (a.likes||0))
        .slice(0, 10)
        .map(m => ({
          id: m.id,
          likes: m.likes || 0,
          tags: m.tags || [],
          why_notable: (m.why_notable || "").slice(0, 120),
        })),
      notable_papers: (research?.arxiv_recent || [])
        .slice(0, 8)
        .map(p => ({
          title: p.title,
          authors: p.authors || "",
          abstract_short: (p.abstract_short || "").slice(0, 200),
          url: p.url || null,
          why_notable: (p.why_notable || "").slice(0, 100),
        })),
    },
    product_launch: {
      top_products: (product?.product_hunt || [])
        .sort((a,b) => (b.votes||0) - (a.votes||0))
        .slice(0, 10)
        .map(p => ({
          name: p.name,
          tagline: (p.tagline || "").slice(0, 120),
          votes: p.votes || 0,
          url: p.url || null,
          why_notable: (p.why_notable || "").slice(0, 100),
        })),
    },
    jobs: {
      emerging_roles: Object.values(
        (jobs?.jobs || []).reduce((acc, j) => {
          const role = (j.title || "").trim();
          if (!role) return acc;
          if (!acc[role]) acc[role] = { role, count: 0, companies: new Set() };
          acc[role].count++;
          acc[role].companies.add(j.company || "");
          return acc;
        }, {})
      )
        .map(r => ({
          role: r.role,
          count: r.count,
          example_companies: [...r.companies].slice(0, 3),
          why_signal: r.count >= 3 ? "Multiple postings; strong demand" : "Emerging role",
        }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 10),
    },
  };

  // Build intelligence layers
  const keyword_clusters = buildKeywordClusters({ signals: rawSignals });
  const new_terms = detectNewTerms({ signals: rawSignals });
  const cross_source_signals = buildCrossSourceSignals({ signals: rawSignals });
  const alpha_candidates = buildAlphaCandidates({ signals: rawSignals });
  const sector_themes = buildSectorThemes({ signals: rawSignals });
  const contrarian_notes = buildContrarianNotes({ signals: rawSignals });

  return {
    date,
    generatedAt: new Date().toISOString(),
    sources: {
      github_trending: { count: (gh?.items?.length || 0), valid: !!(gh?.items?.length) },
      hackernews: { topCount: (hn?.sections?.top?.length || 0), showHnCount: (hn?.sections?.show_hn?.length || 0), valid: !!(hn?.sections?.top?.length || hn?.sections?.show_hn?.length) },
      reddit: {
        totalPosts: ((reddit?.subreddits || []).reduce((sum, s) => sum + (s.posts?.length || 0), 0) +
          (reddit?.global_hot_posts?.length || 0)),
        valid: !!(
          (reddit?.subreddits || []).some(s => s.posts && s.posts.length > 0) ||
          (reddit?.global_hot_posts || []).length > 0
        ),
      },
      research_ml: { hfCount: (research?.huggingface_trending?.length || 0), arxivCount: (research?.arxiv_recent?.length || 0), valid: !!(research?.huggingface_trending?.length || research?.arxiv_recent?.length) },
      product_launch: { productHuntCount: (product?.product_hunt?.length || 0), valid: !!(product?.product_hunt?.length) },
      job_signals: { jobsCount: (jobs?.jobs?.length || 0), valid: !!(jobs?.jobs?.length) },
    },
    signals: rawSignals,
    keyword_clusters,
    new_terms,
    cross_source_signals,
    alpha_candidates,
    sector_themes,
    contrarian_notes,
  };
}

function main() {
  const date = todayISO();
  console.log(`[deep_context] Building intelligence hub for ${date}`);

  const ctx = buildDeepContext(date);

  const dateDir = path.join(DATA_DIR, date);
  if (!fs.existsSync(dateDir)) {
    fs.mkdirSync(dateDir, { recursive: true });
  }
  const outPath = path.join(dateDir, `alpha_deep_context.json`);
  fs.writeFileSync(outPath, JSON.stringify(ctx, null, 2), "utf-8");

  console.log(`[deep_context] Written to: ${outPath}`);
  console.log(`[deep_context] keyword_clusters: ${ctx.keyword_clusters.length}`);
  console.log(`[deep_context] new_terms: ${ctx.new_terms.length}`);
  console.log(`[deep_context] cross_source_signals: ${ctx.cross_source_signals.length}`);
  console.log(`[deep_context] alpha_candidates: ${ctx.alpha_candidates.length}`);
  console.log(`[deep_context] sector_themes: ${ctx.sector_themes.length}`);
  console.log(`[deep_context] contrarian_notes: ${ctx.contrarian_notes.length}`);

  // Validation
  if (!ctx.keyword_clusters?.length) {
    console.error("[deep_context] ERROR: keyword_clusters empty");
    process.exit(1);
  }
  if (!ctx.alpha_candidates?.length) {
    console.error("[deep_context] ERROR: alpha_candidates empty");
    process.exit(1);
  }
  console.log("[deep_context] Validation OK");
  process.exit(0);
}

main();
