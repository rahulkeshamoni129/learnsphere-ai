import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign In — LearnSphere AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you're in!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-float-in">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-3">
            <div className="absolute inset-0 blur-2xl gradient-primary opacity-60" />
            <div className="relative h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">LearnSphere</span> AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your AI study companion</p>
        </div>

        <Card className="glass p-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pw-in">Password</Label>
                  <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full gradient-primary border-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="name-up">Name</Label>
                  <Input id="name-up" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pw-up">Password</Label>
                  <Input id="pw-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full gradient-primary border-0">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}