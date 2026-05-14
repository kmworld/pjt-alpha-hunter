#!/usr/bin/env node

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

// ---------- Hugging Face Trending ----------
async function fetchHF() {
  try {
    const url = "https://huggingface.co/models?sort=trending";
    const resp = await fetch(url, {
      headers: { "User-Agent": "AlphaHunter/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.error(`HF fetch failed: ${resp.status}`);
      return;
    }
    const html = await resp.text();

    const models = [];
    const seen = new Set();

    // Match model links like href="/org/model" (exclude spaces, datasets, docs)
    const linkMatches = [...html.matchAll(/<a[^>]+href="\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)"[^>]*>/g)];

    for (const m of linkMatches) {
      const id = m[1];

      // Skip non-model paths
      if (
        id.includes("spaces") ||
        id.includes("datasets") ||
        id.includes("docs") ||
        id.includes("huggingface") ||
        id.includes("blog") ||
        id.includes("events") ||
        id.includes("collections") ||
        id.includes("enterprise") ||
        id.includes("pricing") ||
        id.includes("transformers") ||
        id.includes("diffusers") ||
        id.includes("accelerate") ||
        id.includes("hub") ||
        id.includes("search") ||
        id.includes("terms-of-service") ||
        id.includes("privacy") ||
        id.includes("gated") ||
        id.includes("settings") ||
        id.includes("resolve") ||
        id.includes("api") ||
        id.includes("upload") ||
        id.includes("login") ||
        id.includes("join") ||
        id.includes("signup") ||
        id.includes("new") ||
        id.includes("organizations") ||
        id.includes("explore") ||
        id.includes("paper") ||
        id.includes("spaces/") ||
        id.includes("datasets/") ||
        id.includes("hf.co/") ||
        id.includes("hf.co") ||
        id.includes("huggingface.co/") ||
        id.includes("huggingface.co") ||
        id.includes("search/full-text") ||
        id.includes("papers/") ||
        id.includes("events/") ||
        id.includes("spaces/") ||
        id.includes("datasets/")
      ) {
        continue;
      }

      if (seen.has(id)) continue;
      seen.add(id);

      // Find context around this link
      const idx = html.indexOf(id);
      if (idx === -1) continue;
      const around = html.slice(idx, idx + 1500).replace(/\n/g, " ");

      let likes = 0;
      let downloads = 0;

      // Try JSON-LD / __NEXT_DATA__ / script tags first
      const jsonMatch = around.match(/"likes"\s*:\s*(\d+)/);
      if (jsonMatch) {
        likes = Number(jsonMatch[1]);
      } else {
        const likesMatch = around.match(/(\d[\d,]*)\s*(?:likes?|❤|♥)/i);
        if (likesMatch) {
          likes = Number(likesMatch[1].replace(/,/g, ""));
        }
      }

      const dlMatch = around.match(/"downloads"\s*:\s*(\d+)/);
      if (!dlMatch) {
        const dlMatch2 = around.match(/(\d[\d,]*)\s*(?:downloads?|dl\s*\//i)/);
        if (dlMatch2) {
          downloads = Number(dlMatch2[1].replace(/,/g, ""));
        }
      } else {
        downloads = Number(dlMatch[1]);
      }

      const name = id.split("/").pop();

      const tags = [];
      const tagCandidates = [
        "transformers",
        "diffusers",
        "safetensors",
        "diffusion",
        "llm",
        "text-generation",
        "text-classification",
        "text-to-image",
        "text-to-speech",
        "automatic-speech-recognition",
        "reinforcement-learning",
        "computer-vision",
        "tokenizers",
        "image-text-to-text",
        "image-to-image",
        "image-to-text",
        "video-generation",
        "audio-generation",
        "music-generation",
        "protein-folding",
        "code-generation",
        "multimodal",
        "image-classification",
        "object-detection",
        "image-segmentation",
        "text-embedding",
        "sentence-embedding",
        "feature-extraction",
        "question-answering",
        "summarization",
        "translation",
        "fill-mask",
        "conversational",
        "image-to-video",
        "video-to-video",
      ];

      for (const t of tagCandidates) {
        if (new RegExp(t, "i").test(around) && !tags.includes(t)) {
          tags.push(t);
        }
      }

      const [whyNotable, sectorThemes] = inferHFWhyNotable(tags, likes, downloads, id);

      models.push({
        id,
        name,
        likes,
        downloads,
        tags,
        sector_themes: sectorThemes,
        why_notable: whyNotable,
        url: `https://huggingface.co/${id}`,
      });

      if (models.length >= 30) break;
    }

    if (models.length > 0) {
      result.huggingface_trending = models;
      hfOk = true;
      console.log(`HF: collected ${models.length} trending models`);
    } else {
      console.log("HF: no models parsed from page");
    }
  } catch (err) {
    console.error("HF error:", err.message);
  }
}

// ---------- HF helpers ----------

function inferHFWhyNotable(tags, likes, downloads, id) {
  const t = (tags || []).join(" ").toLowerCase();
  const themes = [];
  let reason = "";

  if (t.includes("multimodal") || t.includes("image-text-to-text")) {
    themes.push("multimodal");
    reason = "Multimodal model gaining HF traction; signals progress in cross-modal understanding.";
  } else if (t.includes("llm") || t.includes("text-generation") || t.includes("conversational")) {
    themes.push("llm");
    reason = "Frontier or strong conversational model; relevant for agent and assistant workflows.";
  } else if (t.includes("video-generation") || t.includes("image-to-video")) {
    themes.push("video-gen");
    reason = "Video generation model trending; key for content creation and immersive AI.";
  } else if (t.includes("text-to-image") || t.includes("diffusion") || t.includes("image-to-image")) {
    themes.push("image-gen");
    reason = "Image generation/diffusion model with strong HF interest.";
  } else if (t.includes("text-to-speech") || t.includes("audio-generation")) {
    themes.push("tts-audio");
    reason = "TTS/audio model trending; important for voice AI and agent interfaces.";
  } else if (t.includes("code-generation")) {
    themes.push("code-llm");
    reason = "Code-generation model trending; relevant for AI-assisted development.";
  } else if (t.includes("reinforcement-learning")) {
    themes.push("rl");
    reason = "RL-related model; key for agent training and control.";
  } else if (t.includes("computer-vision") || t.includes("object-detection") || t.includes("image-segmentation")) {
    themes.push("computer-vision");
    reason = "Vision model trending; important for robotics, autonomous systems, and AI infra.";
  } else if (t.includes("protein-folding")) {
    themes.push("bio-ai");
    reason = "Bio+AI model; relevant for drug discovery and computational biology.";
  } else {
    themes.push("ml-general");
    reason = "ML model with notable HF traction; worth monitoring for ecosystem impact.";
  }

  if (likes >= 500) {
    reason += " High likes indicate strong community validation.";
  } else if (likes > 0) {
    reason += " Moderate likes; early but meaningful interest.";
  }

  return [reason, themes];
}

// ---------- ArXiv helpers ----------

function inferArxivWhyNotable(title, abstractShort) {
  const t = (title + " " + (abstractShort || "")).toLowerCase();
  const themes = [];
  let reason = "";

  if (t.includes("agent") || t.includes("agentic")) {
    themes.push("ai-agents");
    reason = "Directly relevant to AI agent design, autonomy, or multi-agent systems.";
  } else if (t.includes("llm") || t.includes("large language model") || t.includes("reasoning")) {
    themes.push("llm-reasoning");
    reason = "Relevant to LLM reasoning, alignment, or capability improvements.";
  } else if (t.includes("alignment") || t.includes("safety") || t.includes("robustness")) {
    themes.push("ai-safety");
    reason = "Important for AI safety, alignment, or robustness.";
  } else if (t.includes("code") && (t.includes("generation") || t.includes("generation"))) {
    themes.push("code-llm");
    reason = "Relevant to AI-assisted code generation and developer tools.";
  } else if (t.includes("multimodal") || t.includes("vision") || t.includes("audio")) {
    themes.push("multimodal");
    reason = "Multimodal research; key for cross-modal AI capabilities.";
  } else if (t.includes("security") || t.includes("adversarial") || t.includes("attack")) {
    themes.push("ai-security");
    reason = "AI security or adversarial robustness; important for safe deployment.";
  } else {
    themes.push("ml-general");
    reason = "ML/AI paper with potential impact; worth tracking for emerging directions.";
  }

  return [reason, themes];
}

// ---------- ArXiv Recent Papers ----------
async function fetchArxiv() {
  try {
    const query = "cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CR+OR+cat:cs.SE";
    const url = `https://export.arxiv.org/api/query?search_query=${query}&max_results=30`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.error(`ArXiv fetch failed: ${resp.status}`);
      return;
    }
    const xml = await resp.text();

    const papers = [];
    const entries = xml.split("<entry>");

    for (const entry of entries.slice(1)) {
      // Title: first <title> is usually the paper title
      const titleEl = entry.match(/<title>(.*?)<\/title>/s);
      if (!titleEl) continue;
      let title = titleEl[1].replace(/\s+/g, " ").trim();
      // Skip if looks like a feed-level title
      if (title.startsWith("arXiv Query:")) continue;
      // Clean "arXiv preprint - ..."
      title = title.replace(/arXiv preprint - .*/i, "").trim();
      if (!title) continue;

      // Link: any <link> with rel="alternate" (order-agnostic)
      const linkMatch = entry.match(/<link[^>]+href="([^"]+)"[^>]+rel="alternate"[^>]+>/);
      if (!linkMatch) continue;
      const url = linkMatch[1];

      // Date
      const updatedEl = entry.match(/<updated>(.*?)<\/updated>/);
      const date = (updatedEl && updatedEl[1]) || "";

      // Filter: only papers from last 14 days
      if (date) {
        const paperDate = new Date(date);
        const now = new Date();
        const diffMs = now - paperDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 14) continue; // skip stale papers
      }

      // Summary/abstract
      const summaryEl = entry.match(/<summary>(.*?)<\/summary>/s);
      const abstractRaw = (summaryEl && summaryEl[1] || "").replace(/\s+/g, " ").trim();
      const abstract_short =
        abstractRaw.length > 200 ? abstractRaw.slice(0, 200) + "..." : abstractRaw;

      // Authors
      const authors = [];
      const authorMatches = [...entry.matchAll(/<name>(.*?)<\/name>/g)];
      for (const a of authorMatches) {
        const name = a[1].trim();
        if (name) authors.push(name);
      }

      const [whyNotable, sectorThemes] = inferArxivWhyNotable(title, abstract_short);

      papers.push({
        title,
        date,
        authors: authors.join(", "),
        abstract_short,
        sector_themes: sectorThemes,
        why_notable: whyNotable,
        url,
      });
    }

    if (papers.length > 0) {
      result.arxiv_recent = papers;
      arxivOk = true;
      console.log(`ArXiv: collected ${papers.length} recent papers`);
    } else {
      console.log("ArXiv: no papers parsed");
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

    // Ensure data dir
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
