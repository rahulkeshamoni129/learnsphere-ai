import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiUrl } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/summaries")({
  head: () => ({ meta: [{ title: "Summaries — LearnSphere AI" }] }),
  component: SummariesPage,
});

type Doc = { id: string; name: string; summary: string | null };
const styles = [
  { id: "bullets", label: "Bullet Points" },
  { id: "key-terms", label: "Key Terms" },
  { id: "study-guide", label: "Comprehensive Study Guide" },
] as const;

function SummariesPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("documents").select("id,name,summary").eq("status", "completed").order("created_at", { ascending: false }).then(({ data }) => {
      setDocs(data ?? []);
      if (data?.[0]) { setDocId(data[0].id); setContent(data[0].summary ?? ""); }
    });
  }, []);

  useEffect(() => {
    const d = docs.find((x) => x.id === docId);
    if (d) setContent(d.summary ?? "");
  }, [docId, docs]);

  async function generate(style: string) {
    if (!docId) return;
    setLoading(true);
    try {
      const res = await fetch(aiUrl("/api/generate-summary"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, style }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json() as { summary?: string; content?: string };
      setContent(data.summary ?? data.content ?? "");
      toast.success("Summary ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold">Summaries</h1>
        <p className="text-muted-foreground mt-1">Generate study summaries in different styles.</p>
      </div>

      <Card className="glass p-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <Select value={docId ?? ""} onValueChange={setDocId}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Pick a document" /></SelectTrigger>
            <SelectContent>
              {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <Button key={s.id} variant="outline" size="sm" disabled={!docId || loading} onClick={() => generate(s.id)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> {s.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="glass p-6 min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gradient" /></div>
        ) : content ? (
          <article className="prose prose-invert prose-sm md:prose-base max-w-none prose-headings:font-display">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Pick a document and choose a style to generate a summary.</p>
          </div>
        )}
      </Card>
    </div>
  );
}