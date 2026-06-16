import { NextResponse } from 'next/server';
import { createRequire } from 'module';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const require = createRequire(import.meta.url);
    const parsePdf = require('pdf-parse/lib/pdf-parse');
    
    // Download a sample small PDF (or any URL)
    const res = await fetch("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const data = await parsePdf(buffer);
    return NextResponse.json({ success: true, text: data.text });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack });
  }
}
