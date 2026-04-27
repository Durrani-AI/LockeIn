import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, MapPin, Calendar, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/jobs")({
  component: JobsPage,
});

interface JobRow {
  id: string;
  company: string;
  role_title: string;
  category: "finance" | "technology" | "law" | "graduate";
  job_type: "internship" | "placement" | "graduate";
  location: string;
  deadline: string | null;
  short_summary: string;
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "finance", label: "Finance" },
  { key: "technology", label: "Technology" },
  { key: "law", label: "Law" },
  { key: "graduate", label: "Graduate Schemes" },
] as const;

function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<typeof CATEGORIES[number]["key"]>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jobs")
        .select("id, company, role_title, category, job_type, location, deadline, short_summary")
        .order("deadline", { ascending: true, nullsFirst: false });
      setJobs((data ?? []) as JobRow[]);
      setLoading(false);
    })();
  }, [user]);

  const filtered = jobs.filter((j) => {
    if (cat !== "all" && j.category !== cat) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return j.company.toLowerCase().includes(s) || j.role_title.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Browse jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Curated internships, placements, and graduate schemes. Save what interests you, then tailor your CV and cover letter inside each role.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                (cat === c.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No jobs match.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((j) => (
            <Link
              key={j.id}
              to="/app/jobs/$jobId"
              params={{ jobId: j.id }}
              className="group rounded-xl border border-border bg-card p-5 transition-all hover:border-border-strong hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Briefcase className="h-3 w-3" />
                    {j.company}
                  </div>
                  <h3 className="mt-1 truncate font-display text-base font-semibold group-hover:text-primary">
                    {j.role_title}
                  </h3>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">{j.job_type}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{j.short_summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>
                {j.deadline && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />Apply by {new Date(j.deadline).toLocaleDateString()}
                  </span>
                )}
                <Badge variant="secondary" className="capitalize">{j.category}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
