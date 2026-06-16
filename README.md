# LearnSphere AI

An AI-powered study assistant that transforms your PDFs into an interactive learning experience. Upload a document and instantly get AI-generated summaries, chat with your material using RAG, and test yourself with auto-generated quizzes — all tracked with progress analytics.

## Features

- **PDF Upload & Processing** — Upload any PDF; the backend extracts text, chunks it, generates 768-dim embeddings, and stores them in a vector database for semantic search
- **RAG Chat** — Ask questions about your document; the AI retrieves the most relevant sections and streams a cited answer referencing exact page numbers
- **AI Quiz Generation** — Automatically generate multiple-choice quizzes from your document to test comprehension
- **AI Summaries** — Generate summaries in three styles: Bullet Points, Key Terms, or a full Comprehensive Study Guide
- **Progress Analytics** — Track study time, quiz scores over time, current streak, and achievements

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Next.js 16 + TypeScript (App Router) |
| Frontend | TanStack Start (Vite) + TypeScript |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage (PDF files) |
| LLM | Groq API — llama-3.3-70b-versatile |
| Embeddings | Xenova/bge-base-en-v1.5 (local ONNX, 768-dim) |
| PDF Parsing | pdf-parse |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts |

## Architecture

```
Frontend (TanStack Start / Vite)  ←→  Backend (Next.js API)  ←→  Supabase + Groq
       :5173                                  :3000
```

### PDF Processing Pipeline
1. PDF uploaded to Supabase Storage
2. Backend downloads PDF → extracts text page-by-page
3. Text chunked (800 chars, 150-char overlap)
4. Each chunk embedded via Xenova (local, no API cost)
5. Embeddings stored in Supabase with pgvector
6. Groq generates document summary
7. Document marked `completed`

### RAG Chat Pipeline
1. User question → embedded locally
2. pgvector finds top-5 semantically similar chunks
3. Groq streams answer using retrieved context
4. Response includes `[Page X]` citations

## Setup

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

### 1. Clone and install

```bash
git clone <repo-url>
cd learnsphere-ai

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

**Backend** — create `/.env`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key
```

**Frontend** — create `/frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_AI_API_BASE_URL=http://localhost:3000
```

### 3. Set up Supabase

1. Run the SQL in `supabase_schema.sql` in your Supabase SQL Editor
2. Create a storage bucket named `documents` with these RLS policies:

```sql
-- Allow authenticated users full access to their own folder
CREATE POLICY "Give users access to own folder"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 4. Run locally

Open two terminals:

```bash
# Terminal 1 — Backend (Next.js API)
npm run dev
# Runs on http://localhost:3000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Runs on http://localhost:5173
```

Visit **http://localhost:5173**, sign up, and upload a PDF.

## Project Structure

```
learnsphere-ai/
├── src/                        # Next.js backend
│   ├── app/api/
│   │   ├── process-pdf/        # PDF extraction + embedding
│   │   ├── chat-rag/           # Streaming RAG chat
│   │   ├── generate-quiz/      # AI quiz generation
│   │   └── generate-summary/   # AI summary generation
│   └── lib/
│       ├── gemini.ts           # Groq client setup
│       ├── supabase.ts         # Supabase admin client
│       └── embeddings.ts       # Local Xenova embeddings
├── frontend/                   # TanStack Start SPA
│   └── src/
│       ├── routes/
│       │   ├── _authenticated/ # Protected pages
│       │   │   ├── dashboard.tsx
│       │   │   ├── chat.tsx
│       │   │   ├── quiz.tsx
│       │   │   ├── summaries.tsx
│       │   │   └── analytics.tsx
│       │   └── auth.tsx        # Login / Sign up
│       └── integrations/supabase/  # Auth client
├── supabase_schema.sql         # Database schema + RLS policies
└── package.json
```

## Demo

Sign up with any email address — no email verification required.
Upload a text-based PDF to begin.
