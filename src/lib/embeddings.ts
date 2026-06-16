/**
 * Embeddings module
 * Uses @xenova/transformers locally and on Vercel.
 * On Vercel, it uses the WASM backend to avoid native .so library issues.
 */

// We must set this before importing transformers to force WASM
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  process.env.TRANSFORMERS_JS_NODE_TYPE = 'web';
}

let extractorPromise: any = null;

async function getExtractor() {
  if (!extractorPromise) {
    const transformers = await import("@xenova/transformers");
    
    // Configure for Vercel Serverless environment
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = false;
      transformers.env.cacheDir = '/tmp';
      
      // Force WASM backend instead of Node native bindings
      if (transformers.env.backends?.onnx) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      }
    }
    
    extractorPromise = transformers.pipeline(
      "feature-extraction",
      "Xenova/bge-base-en-v1.5"
    );
  }
  return extractorPromise;
}

/**
 * Generates an embedding for a single text.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Generates embeddings for multiple texts (batched).
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
}
