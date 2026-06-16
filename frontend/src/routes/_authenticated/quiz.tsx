import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aiUrl } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Loader2, GraduationCap, CheckCircle2, XCircle, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({ meta: [{ title: "Quiz Center — LearnSphere AI" }] }),
  component: QuizPage,
});

type Doc = { id: string; name: string };
type Question = { question: string; options: string[]; correctIndex: number; explanation: string };

function QuizPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docId, setDocId] = useState<string | null>(null);
  const [n, setN] = useState(5);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<{ q: string; chosen: number; correct: number }[]>([]);

  useEffect(() => {
    supabase.from("documents").select("id,name").eq("status", "completed").order("created_at", { ascending: false }).then(({ data }) => {
      setDocs(data ?? []);
      if (data?.[0]) setDocId(data[0].id);
    });
  }, []);

  async function generate() {
    if (!docId) return;
    setLoading(true);
    try {
      const res = await fetch(aiUrl("/api/generate-quiz"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, numQuestions: n }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json() as { questions?: Question[] };
      const qs = data.questions ?? [];
      if (!qs.length) throw new Error("No questions returned");
      setQuestions(qs);
      setIdx(0); setSelected(null); setSubmitted(false); setScore(0); setDone(false); setAnswers([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (selected == null || !questions) return;
    setSubmitted(true);
    const cur = questions[idx];
    const correct = selected === cur.correctIndex;
    if (correct) setScore((s) => s + 1);
    setAnswers((a) => [...a, { q: cur.question, chosen: selected, correct: cur.correctIndex }]);
  }

  async function next() {
    if (!questions) return;
    if (idx + 1 >= questions.length) {
      setDone(true);
      const { data: u } = await supabase.auth.getUser();
      const docName = docs.find((d) => d.id === docId)?.name ?? null;
      if (u.user) {
        await supabase.from("quiz_attempts").insert({
          user_id: u.user.id, document_id: docId, document_name: docName,
          score, total_questions: questions.length, answers,
        });
        await supabase.from("study_sessions").insert({
          user_id: u.user.id, duration_minutes: Math.max(5, questions.length * 2), activity: "quiz",
        });
      }
      return;
    }
    setIdx((i) => i + 1); setSelected(null); setSubmitted(false);
  }

  if (done && questions) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="glass p-10 text-center animate-float-in">
          <Trophy className="h-12 w-12 text-gradient mx-auto mb-4" />
          <h2 className="text-3xl font-semibold mb-2">Quiz Complete</h2>
          <div className="text-5xl font-display font-bold text-gradient mb-2">{score}/{questions.length}</div>
          <p className="text-muted-foreground mb-6">{pct}% — saved to your progress.</p>
          <Button onClick={() => { setQuestions(null); }} className="gradient-primary border-0">Take another quiz</Button>
        </Card>
      </div>
    );
  }

  if (questions) {
    const cur = questions[idx];
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Question {idx + 1} of {questions.length}</span>
            <span>Score: {score}</span>
          </div>
          <Progress value={((idx + (submitted ? 1 : 0)) / questions.length) * 100} className="h-1.5" />
        </div>
        <Card className="glass p-6 animate-float-in">
          <h3 className="text-lg font-medium mb-5">{cur.question}</h3>
          <div className="space-y-2">
            {cur.options.map((opt, i) => {
              const isCorrect = submitted && i === cur.correctIndex;
              const isWrong = submitted && i === selected && i !== cur.correctIndex;
              return (
                <button
                  key={i}
                  disabled={submitted}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isCorrect ? "border-emerald-500/50 bg-emerald-500/10" :
                    isWrong ? "border-rose-500/50 bg-rose-500/10" :
                    selected === i ? "border-primary bg-primary/10" :
                    "border-border hover:bg-accent/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {isWrong && <XCircle className="h-4 w-4 text-rose-400" />}
                    {opt}
                  </span>
                </button>
              );
            })}
          </div>
          {submitted && (
            <div className="mt-4 p-3 rounded-lg bg-accent/30 text-sm animate-float-in">
              <strong className="text-gradient">Explanation: </strong>{cur.explanation}
            </div>
          )}
          <div className="flex justify-end mt-5">
            {!submitted ? (
              <Button onClick={submit} disabled={selected == null} className="gradient-primary border-0">Submit</Button>
            ) : (
              <Button onClick={next} className="gradient-primary border-0">
                {idx + 1 >= questions.length ? "Finish" : "Next"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Quiz Center</h1>
        <p className="text-muted-foreground mt-1">Generate an AI quiz from any of your documents.</p>
      </div>
      <Card className="glass p-6 space-y-5">
        <div>
          <label className="text-sm font-medium mb-2 block">Document</label>
          <Select value={docId ?? ""} onValueChange={setDocId}>
            <SelectTrigger><SelectValue placeholder="Pick a document" /></SelectTrigger>
            <SelectContent>
              {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-2">
            <label className="font-medium">Questions</label>
            <span className="text-gradient font-semibold">{n}</span>
          </div>
          <Slider value={[n]} onValueChange={(v) => setN(v[0])} min={3} max={20} step={1} />
        </div>
        <Button onClick={generate} disabled={!docId || loading} className="w-full gradient-primary border-0">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate AI Quiz</>}
        </Button>
        {docs.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5" /> Upload a PDF first on the Dashboard.</p>
        )}
      </Card>
    </div>
  );
}