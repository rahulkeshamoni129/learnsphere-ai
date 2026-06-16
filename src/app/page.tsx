export default function Home() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans antialiased flex flex-col justify-between">
      {/* Decorative gradients */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-purple-900/10 via-blue-900/5 to-transparent pointer-events-none z-0" />
      <div className="absolute -top-[200px] left-[50%] -translate-x-[50%] w-[600px] h-[300px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-16 flex flex-col justify-center relative z-10">
        
        {/* Header */}
        <div className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Backend System Operational
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            LearnSphere AI Backend
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl">
            High-performance Retrieval-Augmented Generation (RAG) and document processing orchestrator powered by Gemini and Supabase.
          </p>
        </div>

        {/* API Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          
          {/* Quick Config Card */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-white mb-3">System Specifications</h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex justify-between border-b border-slate-800/50 pb-2">
                <span>AI Models</span>
                <span className="font-mono text-blue-400">gemini-2.0-flash / text-embedding-004</span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-2">
                <span>Vector Dimension</span>
                <span className="font-mono text-purple-400">768 (pgvector)</span>
              </li>
              <li className="flex justify-between border-b border-slate-800/50 pb-2">
                <span>Database</span>
                <span className="font-mono text-slate-200">Supabase / PostgreSQL</span>
              </li>
              <li className="flex justify-between">
                <span>Orchestrator</span>
                <span className="font-mono text-slate-200">Vercel AI SDK</span>
              </li>
            </ul>
          </div>

          {/* Integration Status Card */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md">
            <h3 className="text-lg font-semibold text-white mb-3">Connection Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Gemini API Connection</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Supabase Connection</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <div className="pt-2 text-xs text-slate-500">
                Setup is complete. Frontend apps should route requests to this endpoint for server-side AI execution.
              </div>
            </div>
          </div>
        </div>

        {/* API Route Documentation Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/70">
            <h2 className="text-xl font-bold text-white">API Reference Endpoints</h2>
            <p className="text-xs text-slate-400 mt-1">Exposed methods for LearnSphere AI frontend client integration</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Method</th>
                  <th className="px-6 py-3.5">Endpoint</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5">Payload Schema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr>
                  <td className="px-6 py-4 font-bold text-emerald-400 font-mono">POST</td>
                  <td className="px-6 py-4 font-mono text-white">/api/process-pdf</td>
                  <td className="px-6 py-4 text-slate-400">Downloads PDF, chunks page text, embeds vectors, and generates overall summary.</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-400">{`{ documentId: string, fileUrl: string }`}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-bold text-emerald-400 font-mono">POST</td>
                  <td className="px-6 py-4 font-mono text-white">/api/chat-rag</td>
                  <td className="px-6 py-4 text-slate-400">Streams chat response based on relevant document chunks with page citations.</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-400">{`{ messages: Message[], documentId: string }`}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-bold text-emerald-400 font-mono">POST</td>
                  <td className="px-6 py-4 font-mono text-white">/api/generate-quiz</td>
                  <td className="px-6 py-4 text-slate-400">Generates a JSON-validated multiple-choice/true-false quiz from document contents.</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-400">{`{ documentId: string, numQuestions?: number }`}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-bold text-emerald-400 font-mono">POST</td>
                  <td className="px-6 py-4 font-mono text-white">/api/generate-summary</td>
                  <td className="px-6 py-4 text-slate-400">Generates customizable summaries (Bullet Points, Key Terms, Comprehensive).</td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-400">{`{ documentId: string, style: string }`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950/20 py-6 text-center text-xs text-slate-500 z-10 relative">
        &copy; {new Date().getFullYear()} LearnSphere AI. Created for Hackathon Submissions. Powered by Next.js.
      </footer>
    </div>
  );
}

