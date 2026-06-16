-- Enable Vector Extension for RAG/Semantic Search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Profiles Table (User details mapped to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    updated_at TIMESTAMP WITH TIME ZONE,
    full_name TEXT,
    avatar_url TEXT
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Create profile trigger when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Documents Table (Learning Materials)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size INT,
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
CREATE POLICY "Users can select own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);


-- 3. Document Sections / Chunks (For Vector Store)
CREATE TABLE IF NOT EXISTS public.document_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768), -- 768 dimensions is standard for Gemini text-embedding-004
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Document Sections
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks of their own documents"
    ON public.document_sections FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.document_sections.document_id
            AND public.documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chunks of their own documents"
    ON public.document_sections FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.document_sections.document_id
            AND public.documents.user_id = auth.uid()
        )
    );


-- 4. Quizzes Table (AI Generated Assessments)
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID REFERENCES public.documents ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    questions JSONB NOT NULL, -- Array of objects: { question, options: [], answer: "", explanation: "" }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Quizzes
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage quizzes for their documents"
    ON public.quizzes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE public.documents.id = public.quizzes.document_id
            AND public.documents.user_id = auth.uid()
        )
    );


-- 5. Quiz Attempts Table (Progress Tracker)
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents ON DELETE CASCADE,
    document_name TEXT,
    quiz_id UUID REFERENCES public.quizzes ON DELETE CASCADE,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    answers JSONB NOT NULL, -- User's response structure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Quiz Attempts
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can select own quiz attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quiz attempts" ON public.quiz_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quiz attempts" ON public.quiz_attempts FOR DELETE USING (auth.uid() = user_id);


-- 6. Learning Progress Table
CREATE TABLE IF NOT EXISTS public.learning_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents ON DELETE CASCADE NOT NULL,
    study_time_seconds INT DEFAULT 0 NOT NULL,
    last_studied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    UNIQUE (user_id, document_id)
);

-- Enable RLS for Learning Progress
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own learning progress" ON public.learning_progress;
CREATE POLICY "Users can select own learning progress" ON public.learning_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own learning progress" ON public.learning_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own learning progress" ON public.learning_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own learning progress" ON public.learning_progress FOR DELETE USING (auth.uid() = user_id);


-- ==========================================
-- Vector Search Match Function
-- ==========================================
CREATE OR REPLACE FUNCTION match_document_sections (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  filter_document_id UUID
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    document_sections.id,
    document_sections.document_id,
    document_sections.content,
    document_sections.metadata,
    1 - (document_sections.embedding <=> query_embedding) AS similarity
  FROM document_sections
  WHERE document_sections.document_id = filter_document_id
    AND 1 - (document_sections.embedding <=> query_embedding) > match_threshold
  ORDER BY document_sections.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- 7. Study Sessions Table (Progress Analytics)
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    duration_minutes INT NOT NULL,
    activity TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Study Sessions
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own study sessions" ON public.study_sessions;
CREATE POLICY "Users can select own study sessions" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own study sessions" ON public.study_sessions FOR DELETE USING (auth.uid() = user_id);
