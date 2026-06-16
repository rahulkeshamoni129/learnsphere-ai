import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnSphere AI" },
      { name: "description", content: "AI-powered learning platform for students." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
      setChecking(false);
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3 animate-float-in">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl gradient-primary opacity-50" />
          <Sparkles className="relative h-12 w-12 text-gradient" />
        </div>
        <p className="text-sm text-muted-foreground">{checking ? "Loading LearnSphere…" : "Redirecting…"}</p>
      </div>
    </div>
  );
}
