import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chatModel } from '@/lib/ai';
import { generateText } from 'ai';

export const runtime = 'nodejs';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

/** Strip markdown code fences and extract raw JSON */
function extractJSON(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Find the first { and last } to extract JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { documentId, numQuestions = 5 } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
    }

    // 1. Fetch document metadata
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('name')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 2. Fetch content chunks (limit to 12 for context)
    const { data: sections, error: secError } = await supabaseAdmin
      .from('document_sections')
      .select('content, metadata')
      .eq('document_id', documentId)
      .limit(12);

    if (secError || !sections || sections.length === 0) {
      return NextResponse.json({ error: 'No content chunks found for this document' }, { status: 400 });
    }

    // Combine chunks
    const contextText = sections
      .map(s => `[Content Section]: ${s.content}`)
      .join('\n\n')
      .slice(0, 10000);

    // 3. Generate quiz using text generation with explicit JSON instructions
    // (avoids json_schema which is unsupported by llama-3.3-70b-versatile on Groq)
    const prompt = `You are an academic assessor. Create a ${numQuestions}-question multiple choice quiz based on this document: "${document.name}".

Document content:
${contextText}

OUTPUT RULES (CRITICAL - follow exactly):
- Respond with ONLY valid JSON, no other text, no markdown, no explanations outside the JSON
- Use this exact structure:
{
  "title": "Quiz title here",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Brief explanation of why this is correct."
    }
  ]
}

Requirements:
- Exactly ${numQuestions} questions
- Each question has exactly 4 options
- "answer" must be the EXACT text of one of the options
- Questions test different concepts from the document
- Vary difficulty from easy to hard`;

    const { text: rawText } = await generateText({
      model: chatModel,
      prompt,
      temperature: 0.3, // Lower temperature for more consistent JSON output
    });

    // 4. Parse the JSON response
    let quizData: QuizData;
    try {
      const jsonStr = extractJSON(rawText);
      quizData = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      console.error('JSON parse error. Raw response:', rawText.substring(0, 500));
      return NextResponse.json(
        { error: 'AI returned invalid JSON. Please try again.' },
        { status: 500 }
      );
    }

    // 5. Validate structure
    if (!quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      return NextResponse.json({ error: 'AI returned empty or invalid quiz structure' }, { status: 500 });
    }

    // 6. Map questions to frontend format (correctIndex)
    const questionsWithIndex = quizData.questions.map((q) => {
      const options = Array.isArray(q.options) ? q.options : [];
      const correctIndex = options.indexOf(q.answer);
      return {
        question: q.question || 'Question',
        options,
        correctIndex: correctIndex !== -1 ? correctIndex : 0,
        explanation: q.explanation || '',
      };
    });

    // 7. Save quiz to the database
    try {
      const { error: insertError } = await supabaseAdmin
        .from('quizzes')
        .insert({
          document_id: documentId,
          title: quizData.title || `Quiz: ${document.name}`,
          questions: quizData.questions,
        });

      if (insertError) {
        console.warn('Failed to save quiz to DB:', insertError.message);
      }
    } catch (dbErr: any) {
      console.warn('DB insertion error for quizzes:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      questions: questionsWithIndex,
    });

  } catch (error: any) {
    console.error('Error in generate-quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
