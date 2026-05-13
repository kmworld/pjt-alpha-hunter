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
      const likesMatch = around.match(/(\d[\d,]*)\s*(?:likes?|❤|♥)/i);
      if (likesMatch) {
        likes = Number(likesMatch[1].replace(/,/g, ""));
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

      models.push({
        id,
        name,
        likes,
        tags,
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

      papers.push({
        title,
        date,
        authors: authors.join(", "),
        abstract_short,
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
