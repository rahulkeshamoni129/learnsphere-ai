let extractorPromise: any = null;

async function getExtractor() {
  if (!extractorPromise) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      process.env.TRANSFORMERS_JS_NODE_TYPE = 'web';
    }
    const transformers = await import('@xenova/transformers');
    // If running on Vercel, we must use /tmp because the filesystem is read-only
    // AND we must force the WASM backend because Vercel doesn't support native .so files
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = false;
      transformers.env.cacheDir = '/tmp';
      
      // Force WASM backend instead of Node native bindings
      if (transformers.env.backends?.onnx) {
        transformers.env.backends.onnx.wasm.numThreads = 1;
      }
    }
    
    extractorPromise = transformers.pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
  }
  return extractorPromise;
}

/**
 * Generates a 768-dimensional embedding for a single text input.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Generates a batch of 768-dimensional embeddings for multiple text inputs.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const extractor = await getExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
}
