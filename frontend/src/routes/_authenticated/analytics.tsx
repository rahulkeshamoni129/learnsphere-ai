import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Flame, Trophy, Upload, Target, Award } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Progress — LearnSphere AI" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [studyData, setStudyData] = useState<{ date: string; minutes: number }[]>([]);
  const [scoreData, setScoreData] = useState<{ date: string; score: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [achievements, setAchievements] = useState<{ name: string; got: boolean; icon: typeof Trophy }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: sessions }, { data: quizzes }, { data: docs }] = await Promise.all([
        supabase.from("study_sessions").select("duration_minutes,created_at").order("created_at"),
        supabase.from("quiz_attempts").select("score,total_questions,created_at").order("created_at"),
        supabase.from("documents").select("id"),
      ]);

      // Last 14 days study trend
      const days: { date: string; minutes: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(), i));
        const label = format(d, "MMM d");
        const mins = (sessions ?? [])
          .filter((s) => startOfDay(new Date(s.created_at)).getTime() === d.getTime())
          .reduce((a, s) => a + (s.duration_minutes ?? 0), 0);
        days.push({ date: label, minutes: mins });
      }
      setStudyData(days);

      setScoreData((quizzes ?? []).map((q) => ({
        date: format(new Date(q.created_at), "MMM d"),
        score: q.total_questions ? Math.round((q.score / q.total_questions) * 100) : 0,
      })));

      // Streak: consecutive days back from today with any session
      const dayKeys = new Set((sessions ?? []).map((s) => format(startOfDay(new Date(s.created_at)), "yyyy-MM-dd")));
      let cur = 0; let cursor = startOfDay(new Date());
      while (dayKeys.has(format(cursor, "yyyy-MM-dd"))) { cur++; cursor = subDays(cursor, 1); }
      setStreak(cur);

      const hasPerfect = (quizzes ?? []).some((q) => q.total_questions && q.score === q.total_questions);
      setAchievements([
        { name: "First PDF Uploaded", got: (docs?.length ?? 0) > 0, icon: Upload },
        { name: "First Quiz Taken", got: (quizzes?.length ?? 0) > 0, icon: Target },
        { name: "Perfect Score", got: hasPerfect, icon: Trophy },
        { name: "5-Day Streak", got: cur >= 5, icon: Flame },
      ]);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold">Progress Analytics</h1>
        <p className="text-muted-foreground mt-1">Your learning, visualized.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center"><Flame className="h-5 w-5 text-white" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Current Streak</div>
              <div className="text-2xl font-display font-semibold">{streak} day{streak === 1 ? "" : "s"}</div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center"><Target className="h-5 w-5 text-white" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Quizzes Taken</div>
              <div className="text-2xl font-display font-semibold">{scoreData.length}</div>
            </div>
          </div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center"><Trophy className="h-5 w-5 text-white" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Average Score</div>
              <div className="text-2xl font-display font-semibold">
                {scoreData.length ? Math.round(scoreData.reduce((a, x) => a + x.score, 0) / scoreData.length) : 0}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass p-5">
          <h2 className="font-medium mb-4">Study Time (last 14 days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyData}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.2 240)" />
                    <stop offset="100%" stopColor="oklch(0.68 0.24 300)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 270 / 0.3)" />
                <XAxis dataKey="date" stroke="oklch(0.6 0.03 270)" fontSize={11} />
                <YAxis stroke="oklch(0.6 0.03 270)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 270)", border: "1px solid oklch(0.3 0.03 270 / 0.5)", borderRadius: 8 }} />
                <Bar dataKey="minutes" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5">
          <h2 className="font-medium mb-4">Quiz Scores Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.03 270 / 0.3)" />
                <XAxis dataKey="date" stroke="oklch(0.6 0.03 270)" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="oklch(0.6 0.03 270)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 270)", border: "1px solid oklch(0.3 0.03 270 / 0.5)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="oklch(0.72 0.2 270)" strokeWidth={2.5} dot={{ fill: "oklch(0.72 0.2 270)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="glass p-5">
        <h2 className="font-medium mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-gradient" />Achievements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {achievements.map((a) => (
            <div key={a.name} className={`p-4 rounded-xl border text-center transition ${a.got ? "glow-border" : "border-border opacity-50"}`}>
              <a.icon className={`h-7 w-7 mx-auto mb-2 ${a.got ? "text-gradient" : "text-muted-foreground"}`} />
              <div className="text-xs font-medium">{a.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{a.got ? "Unlocked" : "Locked"}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}