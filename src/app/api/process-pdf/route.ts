import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chatModel } from '@/lib/ai';
import { getEmbeddings } from '@/lib/embeddings';
import { generateText } from 'ai';
// @ts-ignore - no types for internal path
import parsePdf from 'pdf-parse/lib/pdf-parse.js';
// @ts-ignore
import 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';
// @ts-ignore
import 'pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js';

export const runtime = 'nodejs'; // Ensure nodejs runtime for pdf-parse (Buffer support)

interface Chunk {
  text: string;
  page: number;
}

// Polyfill minimal DOM APIs used by pdf.js when running in Node environments
if (typeof globalThis !== 'undefined') {
  // @ts-ignore
  if (!('DOMMatrix' in globalThis)) {
    // Minimal no-op DOMMatrix implementation to satisfy pdf.js checks
    // pdf.js only uses DOMMatrix as a container for numbers when running
    // in non-browser environments; providing a stub prevents runtime errors.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis.DOMMatrix = class DOMMatrix {};
  }
  // Provide basic shims for ImageData / Path2D / navigator in case pdf.js expects them
  // @ts-ignore
  if (!('ImageData' in globalThis)) {
    // @ts-ignore
    globalThis.ImageData = class ImageData { constructor() {} };
  }
  // @ts-ignore
  if (!('Path2D' in globalThis)) {
    // @ts-ignore
    globalThis.Path2D = class Path2D { constructor() {} };
  }
  if (!('navigator' in globalThis)) {
    // @ts-ignore
    globalThis.navigator = { language: 'en-US' };
  }
}

// Custom page text extractor helper - resilient to bad PDFs
async function extractPages(buffer: Buffer): Promise<Chunk[]> {
  let data: { text: string; numpages: number; info: any };
  
  try {
    // First attempt: standard parse
    data = await parsePdf(buffer);
  } catch (firstErr: any) {
    console.warn('Standard PDF parse failed, trying with v2.0.550 engine:', firstErr.message);
    try {
      // Second attempt: use older pdfjs engine which is more lenient
      data = await parsePdf(buffer, {
        version: 'v2.0.550',
      });
    } catch (secondErr: any) {
      console.warn('v2.0.550 parse also failed, trying v1.10.100:', secondErr.message);
      try {
        data = await parsePdf(buffer, { version: 'v1.10.100' });
      } catch (thirdErr: any) {
        throw new Error(`PDF parsing failed with all engines. The file may be corrupted, password-protected, or a scanned image-only PDF. Original error: ${firstErr.message}`);
      }
    }
  }

  // pdf-parse gives us all text in data.text
  // We split by form feed characters (\f) which pdf-parse uses as page separators
  const rawPages = data.text.split('\f');
  
  const pages: Chunk[] = rawPages
    .map((text: string, index: number) => ({
      page: index + 1,
      text: text.trim(),
    }))
    .filter((p: Chunk) => p.text.length > 0);

  return pages;
}

// Split page text into overlapping chunks if it's too long
function chunkPages(pages: Chunk[], maxChunkSize = 800, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of pages) {
    const text = page.text;
    if (!text) continue;

    if (text.length <= maxChunkSize) {
      chunks.push({ text, page: page.page });
    } else {
      let start = 0;
      while (start < text.length) {
        const end = start + maxChunkSize;
        const chunkText = text.slice(start, end);
        chunks.push({
          text: chunkText,
          page: page.page,
        });
        start += maxChunkSize - overlap;
      }
    }
  }

  return chunks;
}

export async function POST(req: NextRequest) {
  let documentId: string | null = null;

  try {
    const { documentId: docId, fileUrl } = await req.json();

    if (!docId || !fileUrl) {
      return NextResponse.json({ error: 'Missing documentId or fileUrl' }, { status: 400 });
    }

    documentId = docId;

    // 1. Fetch PDF buffer
    let response;
    try {
      response = await fetch(fileUrl);
    } catch (e: any) {
      throw new Error(`CRITICAL_FETCH_ERROR on fileUrl: ${e.message} | URL: ${fileUrl}`);
    }
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF from URL: ${fileUrl} (Status: ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Extract page-by-page text
    const pages = await extractPages(buffer);
    if (pages.length === 0) {
      throw new Error('No readable text found in PDF.');
    }

    // 3. Create chunks
    const chunks = chunkPages(pages);

    // 4. Generate embeddings using local model or HF API
    let embeddings;
    try {
      embeddings = await getEmbeddings(chunks.map(c => c.text));
    } catch (e: any) {
      throw new Error(`CRITICAL_EMBED_ERROR: ${e.message}`);
    }

    // 5. Insert sections and embeddings into Supabase
    const sectionsToInsert = chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.text,
      embedding: embeddings[index],
      metadata: { page: chunk.page },
    }));

    const { error: insertError } = await supabaseAdmin
      .from('document_sections')
      .insert(sectionsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert document sections into Supabase: ${insertError.message}`);
    }

    // 6. Generate Document Summary
    // We combine the first few pages (up to ~6000 characters) to create a summary
    const summaryInput = pages
      .slice(0, 8)
      .map(p => `[Page ${p.page}]\n${p.text}`)
      .join('\n\n')
      .slice(0, 8000);

    const { text: summary } = await generateText({
      model: chatModel,
      prompt: `You are an expert academic tutor. Generate a highly detailed, organized summary of the following document contents. 
      Use bold headings, bullet points, and key definition callouts. Keep the tone helpful, professional, and clear.
      
      Document content:
      ${summaryInput}`,
    });

    // 7. Update document status to completed and save summary
    const { error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ status: 'completed', summary })
      .eq('id', documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    return NextResponse.json({ success: true, summary });

  } catch (error: any) {
    console.error('Error processing PDF:', error);

    // Update status to failed if we have a documentId
    if (documentId) {
      // Persist detailed error text to help diagnose deployed failures.
      // We store the error in the `summary` column prefixed with `__ERROR__:` so
      // it is easy to find and won't be mistaken for a normal summary.
      await supabaseAdmin
        .from('documents')
        .update({ status: 'failed', summary: `__ERROR__: ${error?.message ?? String(error)}` })
        .eq('id', documentId);
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
