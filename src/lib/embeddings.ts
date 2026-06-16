import { pipeline, env } from '@xenova/transformers';

// Configure for Vercel Serverless environment
env.allowLocalModels = false;
env.useBrowserCache = false;
env.cacheDir = '/tmp';

let extractorPromise: any = null;

async function getExtractor() {
  if (!extractorPromise) {
    // bge-base-en-v1.5 is a standard 768-dimension sentence transformer model
    // Xenova/bge-base-en-v1.5 is the ONNX-optimized version
    extractorPromise = pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
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
