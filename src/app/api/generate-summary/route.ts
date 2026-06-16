import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chatModel } from '@/lib/ai';
import { generateText } from 'ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { documentId, style = 'comprehensive' } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // 1. Fetch document sections
    const { data: sections, error: secError } = await supabaseAdmin
      .from('document_sections')
      .select('content')
      .eq('document_id', documentId)
      .limit(15); // limit to avoid token context limits

    if (secError || !sections || sections.length === 0) {
      return NextResponse.json({ error: 'No content chunks found' }, { status: 400 });
    }

    const contextText = sections.map(s => s.content).join('\n\n').slice(0, 15000);

    // 2. Define prompt based on summary style
    let styleInstructions = '';
    if (style === 'bullet_points' || style === 'bullets') {
      styleInstructions = 'Create a concise bullet-point summary highlighting the key takeaways, main findings, and crucial arguments.';
    } else if (style === 'key_terms' || style === 'key-terms') {
      styleInstructions = 'Extract the most important glossary terms, concepts, or formulas from this document and provide a detailed definition/explanation for each in a list.';
    } else {
      styleInstructions = 'Provide a structured, comprehensive chapter-by-chapter or topic-by-topic summary using clear headers, explanation paragraphs, and key takeaways.';
    }

    // 3. Generate summary via Gemini
    const { text: customSummary } = await generateText({
      model: chatModel,
      prompt: `You are an elite study assistant. Your task is to summarize the following course material.
      
      Style Instruction: ${styleInstructions}
      
      Document material:
      ${contextText}
      
      Format the output beautifully using GitHub Markdown.`,
    });

    return NextResponse.json({ success: true, summary: customSummary });

  } catch (error: any) {
    console.error('Error in generate-summary:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
