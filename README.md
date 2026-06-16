# LearnSphere AI

An AI-powered study assistant that transforms your PDFs into an interactive learning experience. Upload a document and instantly get AI-generated summaries, chat with your material using RAG, and test yourself with auto-generated quizzes — all tracked with progress analytics.

---

## Features

- **PDF Upload & Processing** — Extracts text, chunks it, generates 768-dim vector embeddings, stores in a vector database
- **RAG Chat** — Ask questions about your document; AI retrieves the most relevant sections and streams a cited answer with page references
- **AI Quiz Generation** — Auto-generate multiple-choice quizzes from any uploaded document
- **AI Summaries** — Three styles: Bullet Points, Key Terms, or full Comprehensive Study Guide
- **Progress Analytics** — Study time charts, quiz score trends, streak tracking, achievements

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | **Next.js 16** + TypeScript (App Router) |
| Frontend | **TanStack Start** (Vite) + TypeScript |
| Authentication | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL + **pgvector** |
| File Storage | Supabase Storage |
| LLM | **Groq API** — llama-3.3-70b-versatile |
| Embeddings | **Xenova/bge-base-en-v1.5** (local ONNX, no API cost) |
| PDF Parsing | pdf-parse |
| UI | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts |

---

## Project Structure

```
learnsphere-ai/
│
├── src/                            # ── Next.js Backend ──────────────────
│   ├── app/
│   │   ├── api/
│   │   │   ├── process-pdf/        # PDF extraction + chunking + embeddings
│   │   │   ├── chat-rag/           # Streaming RAG chat with page citations
│   │   │   ├── generate-quiz/      # AI quiz generation (MCQ)
│   │   │   └── generate-summary/   # AI summary in multiple styles
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── ai.ts                   # Groq client + model config
│   │   ├── supabase.ts             # Supabase admin client (bypasses RLS)
│   │   └── embeddings.ts           # Local Xenova embedding pipeline
│   └── middleware.ts
│
├── frontend/                       # ── TanStack Start Frontend ──────────
│   └── src/
│       ├── routes/
│       │   ├── __root.tsx          # App shell, auth state listener
│       │   ├── index.tsx           # Landing / redirect
│       │   ├── auth.tsx            # Sign in / Sign up page
│       │   └── _authenticated/     # Protected routes (require login)
│       │       ├── dashboard.tsx   # Upload PDFs, view documents
│       │       ├── chat.tsx        # Chat with PDF (RAG)
│       │       ├── quiz.tsx        # Take AI-generated quizzes
│       │       ├── summaries.tsx   # View/generate summaries
│       │       └── analytics.tsx   # Progress charts and achievements
│       ├── components/
│       │   ├── AppSidebar.tsx      # Navigation sidebar
│       │   └── ui/                 # shadcn/ui component library
│       ├── integrations/supabase/  # Supabase client + types + auth
│       └── styles.css              # Global styles + design tokens
│
├── supabase_schema.sql             # Full DB schema + RLS policies
├── .env.example                    # Backend env template
├── frontend/.env.example           # Frontend env template
├── package.json                    # Backend dependencies
└── frontend/package.json           # Frontend dependencies
```

---

## Setup & Run

### Prerequisites
- **Node.js 20+**
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq](https://console.groq.com/keys) API key (free)

---

### Step 1 — Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/learnsphere-ai.git
cd learnsphere-ai

# Install backend (Next.js) dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

### Step 2 — Set Up Environment Variables

**Backend** — create `/.env` (copy from `.env.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=your-groq-api-key
```

**Frontend** — create `/frontend/.env` (copy from `frontend/.env.example`):
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_AI_API_BASE_URL=http://localhost:3000
```

> Get your Supabase keys from: **Dashboard → Project Settings → API**

---

### Step 3 — Set Up Supabase Database

1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Paste the entire contents of `supabase_schema.sql` and click **Run**
3. Go to **Storage → Create bucket** → name it `documents`, set to **Private**
4. In the SQL Editor, run this to allow users to upload files:

```sql
CREATE POLICY "Give users access to own folder"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

### Step 4 — Run Locally

Open **two terminals**:

```bash
# Terminal 1 — Backend API (Next.js)
npm run dev
# → http://localhost:3000
```

```bash
# Terminal 2 — Frontend (TanStack/Vite)
cd frontend
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Usage

1. **Sign up** with any email (no email verification needed)
2. **Upload a PDF** on the Dashboard — wait for "Completed" status (~20 seconds)
3. **Chat** with the PDF — AI answers with page citations
4. **Take a Quiz** — select the document, choose number of questions
5. **View Summaries** — pick a style and generate
6. **Analytics** — track your study progress over time

---

## Architecture

```
Browser (http://localhost:5173)
        │
        │ REST / Server-Sent Events
        ▼
Next.js API (http://localhost:3000)
  ├── /api/process-pdf     → downloads PDF, extracts + embeds text, stores vectors
  ├── /api/chat-rag        → vector search + streaming AI response
  ├── /api/generate-quiz   → fetch chunks + AI generates MCQ JSON
  └── /api/generate-summary→ fetch chunks + AI generates formatted summary
        │                         │
        ▼                         ▼
   Supabase                   Groq API
 (PostgreSQL +              (llama-3.3-70b)
  pgvector +
  Storage +
  Auth)
```
