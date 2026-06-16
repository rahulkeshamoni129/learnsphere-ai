let extractorPromise: any = null;

async function getExtractor() {
  if (!extractorPromise) {
    const transformers = await import('@xenova/transformers');
    // If running on Vercel, we must use /tmp because the filesystem is read-only
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      transformers.env.allowLocalModels = false;
      transformers.env.useBrowserCache = false;
      transformers.env.cacheDir = '/tmp';
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
