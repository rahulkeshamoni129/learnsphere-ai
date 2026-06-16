import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chatModel } from '@/lib/ai';
import { getEmbedding } from '@/lib/embeddings';
import { streamText } from 'ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messages, documentId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or empty messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'Missing documentId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const latestMessage = messages[messages.length - 1].content;

    // 1. Generate query embedding locally
    const embedding = await getEmbedding(latestMessage);

    // 2. Query Supabase vector DB for matches
    const { data: matches, error: rpcError } = await supabaseAdmin.rpc(
      'match_document_sections',
      {
        query_embedding: embedding,
        match_threshold: 0.1, // Low threshold to get relevant results, LLM will filter out noise
        match_count: 5,
        filter_document_id: documentId,
      }
    );

    if (rpcError) {
      console.error('Vector search error:', rpcError);
      return new Response(JSON.stringify({ error: `Vector search failed: ${rpcError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Compile context text and include metadata
    const context = (matches || [])
      .map((m: any) => `[Page ${m.metadata?.page || 'Unknown'}]: ${m.content}`)
      .join('\n\n');

    // 4. Stream responses back to client
    const result = streamText({
      model: chatModel,
      system: `You are LearnSphere AI, a premium academic assistant. Your goal is to explain concepts clearly, accurately, and helpful.
      
      You must answer the student's question based on the provided PDF context below.
      
      Guidelines:
      - Cite relevant facts by placing the page number inline as [Page X] (e.g. "...as shown in the study guide [Page 3]").
      - Format your response nicely using Markdown (bold text, bullets, numbered lists).
      - If the context doesn't contain the answer, answer using your general knowledge, but clearly prepend your response with a small disclaimer indicating that this answer is derived from general knowledge and not the document.
      
      PDF Context:
      ${context || 'No document context found.'}`,
      messages,
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error('Error in RAG Chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
