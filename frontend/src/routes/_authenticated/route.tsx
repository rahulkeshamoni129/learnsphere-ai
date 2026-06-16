import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border/50 backdrop-blur-md flex items-center px-4 sticky top-0 z-30 bg-background/40">
            <SidebarTrigger />
            <div className="ml-3 font-display text-sm tracking-wide text-muted-foreground">
              LearnSphere <span className="text-gradient font-semibold">AI</span>
            </div>
          </header>
          <main className="flex-1 p-6 animate-float-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}