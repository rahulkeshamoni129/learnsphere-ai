import { createGroq } from '@ai-sdk/groq';

const apiKey = process.env.GROQ_API_KEY || 'placeholder-groq-key-for-build-time-validation';

if (!apiKey) {
  console.warn('Warning: Missing GROQ_API_KEY environment variable.');
}

export const groqAI = createGroq({
  apiKey,
});

// Groq Text/Chat Model (ultra-fast, accurate)
export const chatModel = groqAI('llama-3.3-70b-versatile');

