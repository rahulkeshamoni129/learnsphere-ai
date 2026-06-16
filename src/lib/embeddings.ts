/**
 * Embeddings module
 * Uses @xenova/transformers locally (fast, free, no API keys).
 * Uses Google Gemini (text-embedding-004) on Vercel to avoid native .so library issues.
 * Both models generate 768-dimensional embeddings, which fits our Supabase vector(768) column perfectly.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";

// ──────────────────────────────────────────────────────────────────────────────
// Production path: Google Gemini API (no native binaries needed, extremely reliable)
// ──────────────────────────────────────────────────────────────────────────────
async function geminiEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing. Please add it to Vercel.");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  // Use gemini-embedding-001 and request 768 dimensions (or manually slice) to match Supabase pgvector schema
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  
  const results: number[][] = [];
  
  // Gemini embedding API is fast but we process in batches/loops
  for (const text of texts) {
    try {
      const result = await model.embedContent({
        content: { role: "user", parts: [{ text }] }
      });
      // Ensure exactly 768 dimensions
      results.push(result.embedding.values.slice(0, 768));
    } catch (err: any) {
      console.error("Gemini embed error:", err);
      throw new Error(`Gemini embed error: ${err.message}`);
    }
  }
  
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Development path: local @xenova/transformers (fast, no API key needed)
// ──────────────────────────────────────────────────────────────────────────────
let localExtractorPromise: any = null;

async function getLocalExtractor() {
  if (!localExtractorPromise) {
    const transformers = await import("@xenova/transformers");
    
    // We only ever run this locally, but just in case:
    transformers.env.allowLocalModels = true;
    
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
  const results = await (isVercel ? geminiEmbed([text]) : localEmbed([text]));
  return results[0];
}

/**
 * Generates embeddings for multiple texts (batched).
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  return isVercel ? geminiEmbed(texts) : localEmbed(texts);
}
