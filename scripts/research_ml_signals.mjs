#!/usr/bin/env node
// research_ml_signals.mjs
// - HuggingFace: trending models via official API (likes, downloads).
// - ArXiv: recent AI/ML papers (last 14 days) via public API.
// - Adds why_notable and sector_themes for alpha-quality signals.

const today = new Date().toISOString().slice(0, 10);
const outPath = `data/research_ml_${today}.json`;

const result = {
  source: "research_ml",
  date: today,
  huggingface_trending: [],
  arxiv_recent: [],
};

let hfOk = false;
let arxivOk = false;

// ---------- Hugging Face Trending (API-based) ----------
async function fetchHF() {
  try {
    // Use official API: sort by likes descending, limit 30
    const url =
      "https://huggingface.co/api/models?sort=likes&direction=-1&limit=30&search=";
    const resp = await fetch(url, {
      headers: { "User-Agent": "AlphaHunter/1.0" },
      signal: AbortSignal.timeout(25_000),
    });

    if (!resp.ok) {
      console.error(`HF API fetch failed: ${resp.status}`);
      return;
    }

    const models = await resp.json();
    if (!Array.isArray(models) || models.length === 0) {
      console.log("HF: no models returned from API");
      return;
    }

    const enriched = [];

    for (const m of models) {
      const tags = (m.tags || []).filter(Boolean);
      const [whyNotable, sectorThemes] = inferHFWhyNotable(
        tags,
        m.likes || 0,
        m.downloads || 0,
        m.id || ""
      );

      enriched.push({
        id: m.id,
        name: (m.id || "").split("/").pop(),
        likes: m.likes || 0,
        downloads: m.downloads || 0,
        pipeline_tag: m.pipeline_tag || null,
        tags: tags.slice(0, 20), // keep concise
        sector_themes: sectorThemes,
        why_notable: whyNotable,
        lastModified: m.lastModified || null,
        url: `https://huggingface.co/${m.id}`,
      });
    }

    result.huggingface_trending = enriched;
    hfOk = true;
    console.log(`HF: collected ${enriched.length} trending models`);
  } catch (err) {
    console.error("HF error:", err.message);
  }
}

// ---------- HF helpers ----------
function inferHFWhyNotable(tags, likes, downloads, id) {
  const t = (tags || []).join(" ").toLowerCase();
  const themes = [];
  let reason = "";

  // Classify by primary capability
  if (
    t.includes("multimodal") ||
    t.includes("image-text-to-text") ||
    t.includes("video-text-to-text")
  ) {
    themes.push("multimodal");
    reason =
      "Multimodal model with strong HF traction; signals progress in cross-modal understanding and agent perception.";
  } else if (
    t.includes("text-to-video") ||
    t.includes("image-to-video") ||
    t.includes("video-generation")
  ) {
    themes.push("video-gen");
    reason =
      "Video generation model trending; important for content creation, simulation, and immersive AI.";
  } else if (
    t.includes("text-to-image") ||
    t.includes("image-generation") ||
    (t.includes("diffusion") && !t.includes("video"))
  ) {
    themes.push("image-gen");
    reason =
      "Image generation/diffusion model with strong HF interest; relevant for creative AI and synthetic media.";
  } else if (
    t.includes("text-to-speech") ||
    t.includes("audio-generation") ||
    t.includes("automatic-speech-recognition")
  ) {
    themes.push("tts-audio");
    reason =
      "TTS/audio model trending; important for voice AI, agent interfaces, and accessibility.";
  } else if (
    t.includes("llm") ||
    t.includes("text-generation") ||
    t.includes("conversational")
  ) {
    themes.push("llm");
    reason =
      "Conversational/text-generation model with high HF traction; relevant for agent stacks and assistant workflows.";
  } else if (t.includes("code-generation") || t.includes("code")) {
    themes.push("code-llm");
    reason =
      "Code-generation model trending; directly relevant to AI-assisted development and tool use.";
  } else if (t.includes("reinforcement-learning")) {
    themes.push("rl");
    reason =
      "RL-related model; key for agent training, control, and optimization.";
  } else if (
    t.includes("computer-vision") ||
    t.includes("object-detection") ||
    t.includes("image-segmentation") ||
    t.includes("image-classification")
  ) {
    themes.push("computer-vision");
    reason =
      "Vision model trending; important for robotics, autonomous systems, and AI infra.";
  } else if (t.includes("protein-folding") || t.includes("bio")) {
    themes.push("bio-ai");
    reason =
      "Bio+AI model; relevant for drug discovery, computational biology, and scientific AI.";
  } else {
    themes.push("ml-general");
    reason =
      "ML model with notable HF traction; worth monitoring for ecosystem impact.";
  }

  // Add engagement context
  if (likes >= 5000) {
    reason +=
      " Very high likes indicate strong community validation and likely production relevance.";
  } else if (likes >= 500) {
    reason +=
      " High likes indicate strong community validation.";
  } else if (likes > 0) {
    reason +=
      " Moderate likes; early but meaningful interest.";
  }

  return [reason, themes];
}

// ---------- ArXiv helpers ----------
function inferArxivWhyNotable(title, abstractShort) {
  const combined = ((title || "") + " " + (abstractShort || "")).toLowerCase();
  const themes = [];
  let reason = "";

  if (
    combined.includes("agent") ||
    combined.includes("agentic") ||
    combined.includes("multi-agent")
  ) {
    themes.push("ai-agents");
    reason =
      "Directly relevant to AI agent design, autonomy, or multi-agent systems.";
  } else if (
    combined.includes("llm") ||
    combined.includes("large language model") ||
    combined.includes("reasoning")
  ) {
    themes.push("llm-reasoning");
    reason =
      "Relevant to LLM reasoning, alignment, or capability improvements.";
  } else if (
    combined.includes("alignment") ||
    combined.includes("safety") ||
    combined.includes("robustness") ||
    combined.includes("guardrail")
  ) {
    themes.push("ai-safety");
    reason =
      "Important for AI safety, alignment, or robustness of deployed models.";
  } else if (
    combined.includes("security") ||
    combined.includes("adversarial") ||
    combined.includes("attack") ||
    combined.includes("vulnerab")
  ) {
    themes.push("ai-security");
    reason =
      "AI security or adversarial robustness; important for safe deployment and defense.";
  } else if (
    combined.includes("code") &&
    (combined.includes("generation") || combined.includes("llm"))
  ) {
    themes.push("code-llm");
    reason =
      "Relevant to AI-assisted code generation, developer tools, and software reliability.";
  } else if (
    combined.includes("multimodal") ||
    combined.includes("vision") ||
    combined.includes("audio")
  ) {
    themes.push("multimodal");
    reason =
      "Multimodal research; key for cross-modal AI capabilities and agent perception.";
  } else {
    themes.push("ml-general");
    reason =
      "ML/AI paper with potential impact; worth tracking for emerging directions.";
  }

  return [reason, themes];
}

// ---------- ArXiv Recent Papers (last 14 days) ----------
async function fetchArxiv() {
  // Longer delay to reduce rate-limit risk
  await new Promise((r) => setTimeout(r, 5000));

  const baseQuery = "cat:cs.AI+OR+cat:cs.LG";
  const url = `https://export.arxiv.org/api/query?search_query=${baseQuery}&sortBy=submittedDate&sortOrder=descending&max_results=10`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    console.error(`ArXiv fetch failed: ${resp.status}`);
    return;
  }

  const xml = await resp.text();
  try {
    // Use broad AI/ML categories, sorted by submit date, limited to recent.
    const baseQuery =
      "cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.MA+OR+cat:cs.SE";
    const url = `https://export.arxiv.org/api/query?search_query=${baseQuery}&sortBy=submittedDate&sortOrder=descending&max_results=30`;

    const resp = await fetch(url, {
      signal: AbortSignal.timeout(40_000),
    });

    if (!resp.ok) {
      console.error(`ArXiv fetch failed: ${resp.status}`);
      return;
    }

    const xml = await resp.text();

    const now = new Date();
    const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
    const papers = [];

    const entries = xml.split("<entry>");

    for (const entry of entries.slice(1)) {
      // Title
      const titleEl = entry.match(/<title>(.*?)<\/title>/s);
      if (!titleEl) continue;
      let title = titleEl[1].replace(/\s+/g, " ").trim();
      if (title.startsWith("arXiv Query:")) continue;
      title = title.replace(/arXiv preprint - .*/i, "").trim();
      if (!title) continue;

      // Link
      const linkMatch = entry.match(
        /<link[^>]+href="([^"]+)"[^>]+rel="alternate"[^>]+>/
      );
      if (!linkMatch) continue;
      const paperUrl = linkMatch[1];

      // Date (updated field)
      const updatedEl = entry.match(/<updated>(.*?)<\/updated>/);
      const dateStr = (updatedEl && updatedEl[1]) || "";
      if (!dateStr) continue;

      const paperDate = new Date(dateStr);
      if (isNaN(paperDate.getTime()) || paperDate < cutoff) continue; // skip stale

      // Summary
      const summaryEl = entry.match(/<summary>(.*?)<\/summary>/s);
      const abstractRaw = (summaryEl && summaryEl[1] || "")
        .replace(/\s+/g, " ")
        .trim();
      const abstract_short =
        abstractRaw.length > 220
          ? abstractRaw.slice(0, 220) + "..."
          : abstractRaw;

      // Authors
      const authors = [];
      const authorMatches = [...entry.matchAll(/<name>(.*?)<\/name>/g)];
      for (const a of authorMatches) {
        const name = a[1].trim();
        if (name) authors.push(name);
      }

      const [whyNotable, sectorThemes] = inferArxivWhyNotable(
        title,
        abstract_short
      );

      papers.push({
        title,
        date: dateStr,
        authors: authors.join(", "),
        abstract_short,
        sector_themes: sectorThemes,
        why_notable: whyNotable,
        url: paperUrl,
      });

      if (papers.length >= 30) break; // cap
    }

    if (papers.length > 0) {
      result.arxiv_recent = papers;
      arxivOk = true;
      console.log(`ArXiv: collected ${papers.length} recent papers (last 14 days)`);
    } else {
      console.log("ArXiv: no recent papers within 14 days");
    }
  } catch (err) {
    console.error("ArXiv error:", err.message);
  }
}

// ---------- Main ----------
(async () => {
  try {
    await Promise.all([fetchHF(), fetchArxiv()]);

    if (!hfOk && !arxivOk) {
      console.error("Both sources failed. Exiting.");
      process.exit(1);
    }

    const fs = await import("fs");
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`Written to ${outPath}`);
    process.exit(0);
  } catch (err) {
    console.error("Fatal:", err);
    process.exit(1);
  }
})();
