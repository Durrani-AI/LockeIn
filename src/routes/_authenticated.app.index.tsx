import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, FileText, Brain, PenLine } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Overview,
});

function Overview() {
  const { user } = useAuth();
  const [hasCv, setHasCv] = useState<boolean | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [recentCount, setRecentCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: cvCount }, { data: prof }, { count: clCount }] = await Promise.all([
        supabase.from("cvs").select("id", { count: "exact", head: true }),
        supabase.from("communication_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("cover_letters").select("id", { count: "exact", head: true }),
      ]);
      setHasCv((cvCount ?? 0) > 0);
      setHasProfile(!!prof);
      setRecentCount(clCount ?? 0);
    })();
  }, [user]);

  const steps = [
    { title: "Upload your CV", done: hasCv, to: "/app/cv" as const, icon: FileText },
    { title: "Build your voice profile", done: hasProfile, to: "/app/voice" as const, icon: Brain },
    { title: "Browse & save your first jobs", done: recentCount > 0, to: "/app/jobs" as const, icon: PenLine },
  ];

  const ready = hasCv && hasProfile;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Let's tailor an application.</h1>
      </div>

      {/* Setup checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Get set up</CardTitle>
          <CardDescription>One-time setup so every letter sounds like you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s) => (
            <Link
              key={s.title}
              to={s.to}
              className="flex items-center justify-between rounded-lg border border-border bg-surface/40 p-4 transition-colors hover:border-border-strong hover:bg-surface"
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-full " +
                    (s.done
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {s.done === null ? (
                    <Skeleton className="h-4 w-4 rounded-full" />
                  ) : s.done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <s.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="font-medium">{s.title}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Generate CTA */}
      <Card className={ready ? "border-primary/40 bg-primary-soft/40" : ""}>
        <CardHeader>
          <CardTitle>{ready ? "Ready when you are" : "Finish setup to start"}</CardTitle>
          <CardDescription>
            {ready
              ? "Browse curated internships, placements, and graduate schemes. Tailor your CV and cover letter inside any role."
              : "Upload a CV and complete the voice profile first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <Button asChild size="lg">
              <Link to="/app/jobs">
                Browse jobs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline">
              <Link to={!hasCv ? "/app/cv" : "/app/voice"}>
                {!hasCv ? "Upload your CV" : "Build voice profile"} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {recentCount > 0 && (
        <div className="text-sm text-muted-foreground">
          You've generated <span className="font-semibold text-foreground">{recentCount}</span> letter{recentCount === 1 ? "" : "s"}.{" "}
          <Link to="/app/history" className="text-primary hover:underline">View history →</Link>
        </div>
      )}
    </div>
  );
}
