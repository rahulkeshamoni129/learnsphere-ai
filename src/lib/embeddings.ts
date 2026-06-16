/**
 * Embeddings module - uses HuggingFace Inference API on Vercel/Production,
 * and local @xenova/transformers in development (avoids native .so dependency crash on Vercel).
 */

const HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2";

// ──────────────────────────────────────────────────────────────────────────────
// Production path: HuggingFace Inference API (no native binaries needed)
// ──────────────────────────────────────────────────────────────────────────────
async function hfEmbed(texts: string[]): Promise<number[][]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ inputs: texts }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HuggingFace API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  // HF API returns either number[][] or number[][][] depending on model
  if (Array.isArray(data[0]?.[0])) {
    // Shape: [batch][tokens][dims] — take mean pooling manually
    return (data as number[][][]).map((tokenEmbs) => {
      const dims = tokenEmbs[0].length;
      const mean = new Array(dims).fill(0);
      for (const tok of tokenEmbs) tok.forEach((v, i) => (mean[i] += v));
      return mean.map((v) => v / tokenEmbs.length);
    });
  }
  // Shape: [batch][dims]
  return data as number[][];
}

// ──────────────────────────────────────────────────────────────────────────────
// Development path: local @xenova/transformers (fast, no API key needed)
// ──────────────────────────────────────────────────────────────────────────────
let localExtractorPromise: any = null;

async function getLocalExtractor() {
  if (!localExtractorPromise) {
    const transformers = await import("@xenova/transformers");
    localExtractorPromise = transformers.pipeline(
      "feature-extraction",
      "Xenova/bge-base-en-v1.5"
    );
  }
  return localExtractorPromise;
}

async function localEmbed(texts: string[]): Promise<number[][]> {
  const extractor = await getLocalExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Exported helpers
// ──────────────────────────────────────────────────────────────────────────────
const isVercel = Boolean(process.env.VERCEL);

/**
 * Generates an embedding for a single text.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const results = await (isVercel ? hfEmbed([text]) : localEmbed([text]));
  return results[0];
}

/**
 * Generates embeddings for multiple texts (batched).
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  return isVercel ? hfEmbed(texts) : localEmbed(texts);
}
