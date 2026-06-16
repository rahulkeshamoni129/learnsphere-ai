/**
 * Generates a 768-dimensional embedding for a single text input using HuggingFace API.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api-inference.huggingface.co/pipeline/feature-extraction/Xenova/bge-base-en-v1.5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text })
  });
  if (!res.ok) {
    throw new Error("HuggingFace API error: " + await res.text());
  }
  const data = await res.json();
  // Depending on whether it returns an array of arrays or single array
  return Array.isArray(data[0]) ? data[0] : data;
}

/**
 * Generates a batch of 768-dimensional embeddings for multiple text inputs.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api-inference.huggingface.co/pipeline/feature-extraction/Xenova/bge-base-en-v1.5", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: texts })
  });
  if (!res.ok) {
    throw new Error("HuggingFace API error: " + await res.text());
  }
  const data = await res.json();
  // Ensure it returns a 2D array
  return Array.isArray(data[0]) && Array.isArray(data[0][0]) ? data.map((d: any) => d[0]) : data;
}
