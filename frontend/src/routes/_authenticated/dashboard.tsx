import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiUrl, formatBytes } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Clock, BookOpen, Trophy, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LearnSphere AI" }] }),
  component: DashboardPage,
});

type Doc = { id: string; name: string; file_size: number; status: string; created_at: string };
type QuizRow = { score: number; total_questions: number; document_name: string | null; document_id: string | null };

function DashboardPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState({ docs: 0, quizzes: 0, avgScore: 0, hours: 0 });
  const [weak, setWeak] = useState<QuizRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async (silent = false) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: d }, { data: q }, { data: s }] = await Promise.all([
      supabase.from("documents").select("id,name,file_size,status,created_at").order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("score,total_questions,document_name,document_id"),
      supabase.from("study_sessions").select("duration_minutes"),
    ]);
    setDocs(prev => {
      // Notify when a doc transitions from processing to completed
      if (!silent && prev.length > 0) {
        (d ?? []).forEach(newDoc => {
          const old = prev.find(p => p.id === newDoc.id);
          if (old?.status === 'processing' && newDoc.status === 'completed') {
            toast.success(`✅ "${newDoc.name}" is ready! Click to start learning.`);
          } else if (old?.status === 'processing' && newDoc.status === 'failed') {
            toast.error(`❌ Failed to process "${newDoc.name}". The PDF may be scanned or corrupted.`);
          }
        });
      }
      return d ?? [];
    });
    const quizzes = q ?? [];
    const avg = quizzes.length
      ? Math.round((quizzes.reduce((a, r) => a + (r.total_questions ? r.score / r.total_questions : 0), 0) / quizzes.length) * 100)
      : 0;
    const minutes = (s ?? []).reduce((a, r) => a + (r.duration_minutes ?? 0), 0);
    setStats({ docs: d?.length ?? 0, quizzes: quizzes.length, avgScore: avg, hours: +(minutes / 60).toFixed(1) });
    setWeak(quizzes.filter((r) => r.total_questions && r.score / r.total_questions < 0.7).slice(0, 3));
    return d ?? [];
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-poll every 4s while any doc is processing
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'processing');
    if (!hasProcessing) return;
    const timer = setInterval(() => load(false), 4000);
    return () => clearInterval(timer);
  }, [docs, load]);


  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type === "application/pdf");
    if (!arr.length) return toast.error("Please upload PDF files");
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      for (const file of arr) {
        const path = `${u.user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 7);
        const fileUrl = signed?.signedUrl ?? "";
        const { data: row, error: insErr } = await supabase.from("documents").insert({
          user_id: u.user.id, name: file.name, file_url: fileUrl, storage_path: path, file_size: file.size, status: "processing",
        }).select().single();
        if (insErr) throw insErr;
        // fire-and-forget call to external backend
        fetch(aiUrl("/api/process-pdf"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: row.id, fileUrl }),
        }).catch(() => {/* surfaced by status badge */});
        toast.success(`Uploaded ${file.name}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [load]);

  const statusBadge = (status: string) => {
    const map: Record<string, { c: string; icon: typeof CheckCircle2; label: string }> = {
      processing: { c: "bg-amber-500/10 text-amber-300 border-amber-500/30", icon: Loader2, label: "Processing" },
      completed: { c: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", icon: CheckCircle2, label: "Completed" },
      failed: { c: "bg-rose-500/10 text-rose-300 border-rose-500/30", icon: AlertCircle, label: "Failed" },
    };
    const v = map[status] ?? map.processing;
    const Icon = v.icon;
    return (
      <Badge className={`${v.c} border gap-1.5 font-normal`}>
        <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {v.label}
      </Badge>
    );
  };

  const statCards = [
    { label: "Total Documents", value: stats.docs, icon: BookOpen },
    { label: "Completed Quizzes", value: stats.quizzes, icon: GraduationIcon },
    { label: "Average Score", value: `${stats.avgScore}%`, icon: Trophy },
    { label: "Study Hours", value: `${stats.hours}h`, icon: Clock },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Upload material and let AI guide your study.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="glass p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-gradient" />
            </div>
            <div className="text-2xl font-semibold font-display">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card
        className={`glass p-8 border-dashed transition-all ${dragOver ? "scale-[1.01] border-primary" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mb-4">
            {uploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Upload className="h-6 w-6 text-white" />}
          </div>
          <h3 className="text-lg font-medium mb-1">Drop your PDFs here</h3>
          <p className="text-sm text-muted-foreground mb-4">Or click to browse — we'll parse, embed and summarize.</p>
          <label>
            <input type="file" accept="application/pdf" multiple className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            <Button asChild className="gradient-primary border-0 cursor-pointer">
              <span>Browse PDFs</span>
            </Button>
          </label>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="glass p-5 lg:col-span-2">
          <h2 className="text-lg font-medium mb-4">Your Documents</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No documents yet — upload one to get started.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => d.status === "completed" && navigate({ to: "/chat", search: { doc: d.id } })}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/40 transition text-left"
                >
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(d.file_size)} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  {statusBadge(d.status)}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="glass p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-gradient" />
            <h2 className="text-lg font-medium">Revision Tips</h2>
          </div>
          {weak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Take some quizzes — we'll suggest topics to revise.</p>
          ) : (
            <ul className="space-y-3">
              {weak.map((w, i) => (
                <li key={i} className="text-sm">
                  Revisit <span className="font-medium text-foreground">{w.document_name ?? "a document"}</span>
                  <span className="text-muted-foreground"> — {Math.round((w.score / w.total_questions) * 100)}% on last quiz</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function GraduationIcon(props: React.ComponentProps<typeof CheckCircle2>) {
  return <Trophy {...props} />;
}