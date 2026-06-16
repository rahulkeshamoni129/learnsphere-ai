import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { aiUrl } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ doc: z.string().optional() });

export const Route = createFileRoute("/_authenticated/chat")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "AI Chat — LearnSphere AI" }] }),
  component: ChatPage,
});

type Doc = { id: string; name: string; summary: string | null; file_url: string };
type Msg = { role: "user" | "assistant"; content: string };

function ChatPage() {
  const search = Route.useSearch();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(search.doc ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const selected = docs.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    supabase.from("documents").select("id,name,summary,file_url").eq("status", "completed").order("created_at", { ascending: false }).then(({ data }) => {
      setDocs(data ?? []);
      if (!selectedId && data?.[0]) setSelectedId(data[0].id);
    });
  }, [selectedId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  async function send() {
    if (!input.trim() || !selectedId || streaming) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch(aiUrl("/api/chat-rag"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg], documentId: selectedId }),
      });
      if (!res.ok || !res.body) throw new Error("Chat request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat error");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-7rem)] max-w-7xl mx-auto">
      <Card className="glass p-5 flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-gradient" />
          <h2 className="font-medium">Study Guide</h2>
        </div>
        <ScrollArea className="flex-1 -mx-2 px-2">
          {!selected ? (
            <p className="text-sm text-muted-foreground p-8 text-center">Select a document to view its AI summary.</p>
          ) : selected.summary ? (
            <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.summary}</ReactMarkdown>
            </article>
          ) : (
            <div className="text-sm text-muted-foreground p-8 text-center">
              No summary yet — visit the Summaries page to generate one.
            </div>
          )}
        </ScrollArea>
      </Card>

      <Card className="glass p-5 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gradient" />
            <h2 className="font-medium">Chat with your PDF</h2>
          </div>
          <Select value={selectedId ?? ""} onValueChange={(v) => { setSelectedId(v); setMessages([]); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Pick a document" /></SelectTrigger>
            <SelectContent>
              {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-8">
              <p className="text-sm text-muted-foreground">Ask anything about your document. The AI will cite pages.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-float-in`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user" ? "gradient-primary text-white" : "glass"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="my-1">{renderCitations(children)}</p>,
                          }}
                        >
                          {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={!selectedId || streaming} />
          <Button type="submit" disabled={!input.trim() || !selectedId || streaming} className="gradient-primary border-0">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function renderCitations(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    const parts = children.split(/(\[Page \d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[Page (\d+)\]$/);
      if (m) {
        return (
          <button
            key={i}
            onClick={() => toast.message(`Citation: Page ${m[1]}`)}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs rounded-md gradient-primary text-white hover:opacity-90 transition"
          >Page {m[1]}</button>
        );
      }
      return <span key={i}>{p}</span>;
    });
  }
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{renderCitations(c)}</span>);
  return children;
}