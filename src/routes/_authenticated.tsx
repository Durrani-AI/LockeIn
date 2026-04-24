import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { Sparkles, FileText, Brain, PenLine, History, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

type NavItem = {
  to: "/app" | "/app/cv" | "/app/voice" | "/app/generate" | "/app/history";
  label: string;
  icon: typeof Sparkles;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: Sparkles, exact: true },
  { to: "/app/cv", label: "Your CV", icon: FileText },
  { to: "/app/voice", label: "Voice profile", icon: Brain },
  { to: "/app/generate", label: "Generate letter", icon: PenLine },
  { to: "/app/history", label: "History", icon: History },
];

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-6 lg:px-8">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <Link to="/" className="mb-8 flex items-center gap-2 px-2 font-display text-lg font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </span>
            Tailor
          </Link>

          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-lg border border-border bg-card p-3">
            <div className="truncate text-xs text-muted-foreground">Signed in</div>
            <div className="truncate text-sm font-medium">{user.email}</div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Mobile top nav */}
        <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Tailor
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="min-w-0 flex-1 pt-14 lg:pt-0">
          <Outlet />
          {/* Mobile bottom nav */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/95 px-2 py-2 backdrop-blur lg:hidden">
            {NAV.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label.split(" ")[0]}
                </Link>
              );
            })}
          </nav>
          <div className="h-16 lg:hidden" />
        </main>
      </div>
    </div>
  );
}
