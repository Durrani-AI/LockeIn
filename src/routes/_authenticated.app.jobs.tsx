import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { syncJobsFromJsearchApi } from "@/lib/api/jobs-client";

export const Route = createFileRoute("/_authenticated/app/jobs")({
  component: JobsPage,
});

type Category = "finance" | "technology" | "law" | "graduate";
type JobType = "internship" | "placement" | "graduate";

interface JobRow {
  id: string;
  company: string;
  role_title: string;
  category: Category;
  job_type: JobType;
  location: string;
  deadline: string | null;
  created_at: string;
  short_summary: string;
  requirements: string | null;
}

interface SavedRow {
  job_id: string;
  status: string | null;
}

const TYPE_TABS: { key: "all" | JobType; label: string }[] = [
  { key: "all", label: "All Roles" },
  { key: "internship", label: "Summer Internships" },
  { key: "placement", label: "Industrial Placements" },
  { key: "graduate", label: "Graduate Schemes" },
];

const CATEGORY_LABELS: Record<Category, string> = {
  finance: "Finance & Banking",
  technology: "Technology & Engineering",
  law: "Law & Consulting",
  graduate: "General Graduate",
};

const STATUS_OPTIONS = [
  "Not Applied",
  "Saved",
  "Application Submitted",
  "Interviewing",
  "Offer",
  "Rejected",
] as const;

const AUTO_SYNC_STORAGE_KEY = "lockedin:auto-jsearch-sync-at";
const AUTO_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_SYNC_MIN_JOB_COUNT = 120;

function statusClass(status: string | null | undefined) {
  switch (status) {
    case "Application Submitted":
      return "text-emerald-400";
    case "Interviewing":
      return "text-amber-400";
    case "Offer":
      return "text-emerald-300";
    case "Rejected":
      return "text-rose-400";
    case "Saved":
      return "text-sky-400";
    default:
      return "text-rose-400/80 italic";
  }
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function deadlineClass(d: string | null) {
  if (!d) return "text-muted-foreground";
  const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-muted-foreground line-through";
  if (days < 14) return "text-amber-400 font-medium";
  return "text-foreground";
}

function JobsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncQuery, setSyncQuery] = useState("");
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const [tab, setTab] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const loadJobs = useCallback(async (userId: string) => {
    setLoading(true);
    const [jobsRes, savedRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, company, role_title, category, job_type, location, deadline, created_at, short_summary, requirements",
        )
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase.from("saved_jobs").select("job_id, status").eq("user_id", userId),
    ]);

    setJobs((jobsRes.data ?? []) as JobRow[]);
    const map: Record<string, string> = {};
    ((savedRes.data ?? []) as SavedRow[]).forEach((r) => {
      if (r.status) map[r.job_id] = r.status;
    });
    setSaved(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadJobs(user.id);
  }, [loadJobs, user]);

  const runSync = useCallback(
    async ({ query, manual }: { query?: string; manual: boolean }) => {
      if (!user || syncing) return;

      setSyncing(true);
      try {
        const result = await syncJobsFromJsearchApi({
          query: query?.trim() || undefined,
          page: 1,
        });

        setLastImportCount(result.imported);
        await loadJobs(user.id);

        if (manual) {
          toast.success(`Imported ${result.imported} role${result.imported === 1 ? "" : "s"} from JSearch`);
        } else if (result.imported > 0) {
          toast.success(`Auto-imported ${result.imported} fresh role${result.imported === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        if (manual) {
          toast.error(error instanceof Error ? error.message : "JSearch sync failed");
        } else {
          console.error("Background JSearch sync failed", error);
        }
      } finally {
        setSyncing(false);
      }
    },
    [loadJobs, syncing, user],
  );

  const syncFromJsearch = async () => {
    await runSync({ query: syncQuery, manual: true });
  };

  useEffect(() => {
    if (!user || loading || syncing) return;
    if (jobs.length >= AUTO_SYNC_MIN_JOB_COUNT) return;
    if (typeof window === "undefined") return;

    const lastRaw = window.localStorage.getItem(AUTO_SYNC_STORAGE_KEY);
    const lastSyncAt = Number(lastRaw || "0");
    if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < AUTO_SYNC_MIN_INTERVAL_MS) {
      return;
    }

    window.localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));
    void runSync({ manual: false });
  }, [jobs.length, loading, runSync, syncing, user]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (tab !== "all" && j.job_type !== tab) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        if (
          !j.company.toLowerCase().includes(s) &&
          !j.role_title.toLowerCase().includes(s)
        )
          return false;
      }
      if (statusFilter !== "all") {
        const s = saved[j.id] ?? "Not Applied";
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [jobs, tab, q, statusFilter, saved]);

  const grouped = useMemo(() => {
    const groups: Record<Category, JobRow[]> = {
      finance: [],
      technology: [],
      law: [],
      graduate: [],
    };
    filtered.forEach((j) => groups[j.category].push(j));
    return groups;
  }, [filtered]);

  const toggle = (cat: Category) =>
    setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));

  // This route has a nested child (/app/jobs/$jobId). Render it when active.
  if (/^\/app\/jobs\/[^/]+$/.test(location.pathname)) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Application Tracker
        </h1>
        <p className="mt-1 text-muted-foreground">
          Curated internships, placements, and graduate schemes. Click any
          programme to view full details and tailor your CV or cover letter.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company or role…"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Filter by My Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">No filters applied</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <p className="text-xs text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            of {jobs.length} roles
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={syncQuery}
            onChange={(e) => setSyncQuery(e.target.value)}
            placeholder="Optional query to narrow import (leave empty for full market import)"
            className="sm:flex-1"
          />
          <Button type="button" onClick={syncFromJsearch} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Import from JSearch
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pull fresh roles from JSearch into your shared jobs catalog. Leaving the query empty imports across technology, finance, law, and graduate markets.
        </p>
        {lastImportCount !== null ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Last import updated {lastImportCount} role{lastImportCount === 1 ? "" : "s"}.
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No roles match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-semibold w-[160px]">
                    My Status
                  </th>
                  <th className="px-3 py-3 text-left font-semibold w-[180px]">
                    Company
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Programme Name
                  </th>
                  <th className="px-3 py-3 text-left font-semibold w-[110px]">
                    Opening
                  </th>
                  <th className="px-3 py-3 text-left font-semibold w-[110px]">
                    Closing
                  </th>
                  <th className="px-3 py-3 text-center font-semibold w-[60px]">
                    CV
                  </th>
                  <th className="px-3 py-3 text-center font-semibold w-[110px]">
                    Cover Letter
                  </th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(grouped) as Category[]).map((cat) => {
                  const rows = grouped[cat];
                  if (rows.length === 0) return null;
                  const isCollapsed = collapsed[cat];
                  return (
                    <FragmentGroup
                      key={cat}
                      cat={cat}
                      rows={rows}
                      collapsed={!!isCollapsed}
                      onToggle={() => toggle(cat)}
                      saved={saved}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentGroup({
  cat,
  rows,
  collapsed,
  onToggle,
  saved,
}: {
  cat: Category;
  rows: JobRow[];
  collapsed: boolean;
  onToggle: () => void;
  saved: Record<string, string>;
}) {
  return (
    <>
      <tr className="bg-muted/40">
        <td colSpan={7} className="px-3 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground/90 hover:text-primary"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {CATEGORY_LABELS[cat]}
            <span className="ml-1 text-muted-foreground font-normal normal-case tracking-normal">
              ({rows.length})
            </span>
          </button>
        </td>
      </tr>
      {!collapsed &&
        rows.map((j) => {
          const status = saved[j.id] ?? "Not Applied";
          const reqs = (j.requirements ?? "").toLowerCase();
          const needsCover = !reqs.includes("no cover letter");
          return (
            <tr
              key={j.id}
              className="group border-b border-border/50 transition-colors hover:bg-muted/30"
            >
              <td className={cn("px-3 py-2.5 text-xs", statusClass(status))}>
                {status}
              </td>
              <td className="px-3 py-2.5">
                <Link
                  to="/app/jobs/$jobId"
                  params={{ jobId: j.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {j.company}
                </Link>
                <div className="text-[11px] text-muted-foreground">
                  {j.location}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Link
                  to="/app/jobs/$jobId"
                  params={{ jobId: j.id }}
                  className="text-foreground hover:text-primary hover:underline"
                >
                  {j.role_title}
                </Link>
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {formatDate(j.created_at)}
              </td>
              <td className={cn("px-3 py-2.5 text-xs", deadlineClass(j.deadline))}>
                {formatDate(j.deadline)}
              </td>
              <td className="px-3 py-2.5 text-center text-xs text-emerald-400">
                Yes
              </td>
              <td className="px-3 py-2.5 text-center text-xs">
                <span
                  className={
                    needsCover ? "text-emerald-400" : "text-muted-foreground"
                  }
                >
                  {needsCover ? "Yes" : "Optional"}
                </span>
              </td>
            </tr>
          );
        })}
    </>
  );
}
