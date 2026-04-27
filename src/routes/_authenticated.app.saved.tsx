import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, MapPin, Calendar, Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/saved")({
  component: SavedPage,
});

interface Row {
  id: string;
  status: string;
  updated_at: string;
  jobs: {
    id: string;
    company: string;
    role_title: string;
    category: string;
    job_type: string;
    location: string;
    deadline: string | null;
  } | null;
}

const STATUS_COLOURS: Record<string, string> = {
  saved: "bg-muted text-muted-foreground",
  applying: "bg-primary-soft text-primary",
  applied: "bg-primary-soft text-primary",
  interviewing: "bg-warning/15 text-warning",
  offer: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

function SavedPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("saved_jobs")
        .select("id, status, updated_at, jobs(id, company, role_title, category, job_type, location, deadline)")
        .order("updated_at", { ascending: false });
      setRows((data ?? []) as never);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Saved & application tracker</h1>
        <p className="mt-1 text-muted-foreground">Every job you've saved with its current status.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bookmark className="h-5 w-5" />
            </div>
            <div className="font-medium">Nothing saved yet</div>
            <Link to="/app/jobs" className="text-sm text-primary hover:underline">Browse jobs →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => r.jobs && (
            <Link
              key={r.id}
              to="/app/jobs/$jobId"
              params={{ jobId: r.jobs.id }}
              className="block rounded-xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />{r.jobs.company}
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold">{r.jobs.role_title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.jobs.location}</span>
                    {r.jobs.deadline && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.jobs.deadline).toLocaleDateString()}</span>}
                    <Badge variant="secondary" className="capitalize">{r.jobs.category}</Badge>
                  </div>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-medium capitalize " + (STATUS_COLOURS[r.status] ?? "bg-muted text-muted-foreground")}>
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
