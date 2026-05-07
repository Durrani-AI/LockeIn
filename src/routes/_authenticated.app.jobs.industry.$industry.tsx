import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { syncJobsFromJsearchApi } from "@/lib/api/jobs-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT,
  AUTO_SYNC_MIN_INTERVAL_MS,
  AUTO_SYNC_STORAGE_KEY,
  compareJobsByFreshness,
  deadlineClass,
  formatDate,
  getJobFreshnessDate,
  getPrimaryTrack,
  getTrackDefinition,
  INDUSTRY_DEFINITIONS,
  jobMatchesIndustry,
  jobMatchesTrack,
  parseIndustry,
  STATUS_OPTIONS,
  statusClass,
  TYPE_TABS,
  type Industry,
  type JobRow,
  type SavedRow,
} from "@/lib/jobs/industry-taxonomy";

export const Route = createFileRoute("/_authenticated/app/jobs/industry/$industry")({
  component: IndustryJobsPage,
});

function IndustryJobsPage() {
  const params = Route.useParams();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncQuery, setSyncQuery] = useState("");
  const [lastImportCount, setLastImportCount] = useState<number | null>(null);
  const [tab, setTab] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTrackKey, setSelectedTrackKey] = useState<string | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selectedIndustry = parseIndustry(params.industry);
  const selectedIndustryDefinition = selectedIndustry ? INDUSTRY_DEFINITIONS[selectedIndustry] : null;
  const selectedTrack = selectedIndustry ? getTrackDefinition(selectedIndustry, selectedTrackKey) : undefined;

  const loadJobs = useCallback(async (userId: string) => {
    setLoading(true);
    const [jobsRes, savedRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, company, role_title, category, job_type, location, deadline, created_at, posted_at, short_summary, requirements",
        )
        .order("created_at", { ascending: false }),
      supabase.from("saved_jobs").select("job_id, status").eq("user_id", userId),
    ]);

    const nextJobs = [...(((jobsRes.data ?? []) as JobRow[]))].sort(compareJobsByFreshness);
    setJobs(nextJobs);

    const map: Record<string, string> = {};
    ((savedRes.data ?? []) as SavedRow[]).forEach((row) => {
      if (row.status) {
        map[row.job_id] = row.status;
      }
    });
    setSaved(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadJobs(user.id);
  }, [loadJobs, user]);

  useEffect(() => {
    setSelectedTrackKey(undefined);
    setCollapsed({});
  }, [selectedIndustry]);

  const runSync = useCallback(
    async ({ query, manual, industry }: { query?: string; manual: boolean; industry: Industry }) => {
      if (!user || syncing) return;

      setSyncing(true);
      try {
        const result = await syncJobsFromJsearchApi({
          query: query?.trim() || undefined,
          page: 1,
          industry,
        });

        setLastImportCount(result.imported);
        await loadJobs(user.id);

        const scopeLabel = INDUSTRY_DEFINITIONS[industry].label.toLowerCase();
        if (manual) {
          toast.success(`Imported ${result.imported} ${scopeLabel} role${result.imported === 1 ? "" : "s"} from JSearch`);
        } else if (result.imported > 0) {
          toast.success(`Auto-imported ${result.imported} fresh ${scopeLabel} role${result.imported === 1 ? "" : "s"}.`);
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
    if (!selectedIndustry) return;
    await runSync({ query: syncQuery, manual: true, industry: selectedIndustry });
  };

  const scopedJobs = useMemo(() => {
    if (!selectedIndustry) {
      return [] as JobRow[];
    }

    return jobs.filter((job) => jobMatchesIndustry(job, selectedIndustry));
  }, [jobs, selectedIndustry]);

  useEffect(() => {
    if (!user || loading || syncing || !selectedIndustry) return;
    if (typeof window === "undefined") return;
    if (scopedJobs.length >= AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT) return;

    const storageKey = `${AUTO_SYNC_STORAGE_KEY}:${selectedIndustry}`;
    const lastRaw = window.localStorage.getItem(storageKey);
    const lastSyncAt = Number(lastRaw || "0");

    if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < AUTO_SYNC_MIN_INTERVAL_MS) {
      return;
    }

    window.localStorage.setItem(storageKey, String(Date.now()));
    void runSync({ manual: false, industry: selectedIndustry });
  }, [loading, runSync, scopedJobs.length, selectedIndustry, syncing, user]);

  const filteredBeforeTrack = useMemo(() => {
    return scopedJobs.filter((job) => {
      if (tab !== "all" && job.job_type !== tab) return false;

      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const haystack = `${job.company} ${job.role_title} ${job.location} ${job.short_summary} ${job.requirements ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (statusFilter !== "all") {
        const jobStatus = saved[job.id] ?? "Not Applied";
        if (jobStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [scopedJobs, searchText, statusFilter, saved, tab]);

  const filteredJobs = useMemo(() => {
    if (!selectedIndustry || !selectedTrackKey) {
      return filteredBeforeTrack;
    }

    return filteredBeforeTrack.filter((job) => jobMatchesTrack(job, selectedIndustry, selectedTrackKey));
  }, [filteredBeforeTrack, selectedIndustry, selectedTrackKey]);

  const trackCounts = useMemo(() => {
    if (!selectedIndustryDefinition || !selectedIndustry) {
      return {} as Record<string, number>;
    }

    const counts: Record<string, number> = {};
    selectedIndustryDefinition.tracks.forEach((track) => {
      counts[track.key] = filteredBeforeTrack.filter((job) => jobMatchesTrack(job, selectedIndustry, track.key)).length;
    });
    return counts;
  }, [filteredBeforeTrack, selectedIndustry, selectedIndustryDefinition]);

  const groupedTracks = useMemo(() => {
    if (!selectedIndustryDefinition || !selectedIndustry) {
      return [] as Array<{ key: string; label: string; description: string; rows: JobRow[] }>;
    }

    const sections = new Map<string, JobRow[]>();
    selectedIndustryDefinition.tracks.forEach((track) => sections.set(track.key, []));
    const generalRows: JobRow[] = [];

    filteredJobs.forEach((job) => {
      const primaryTrack = getPrimaryTrack(job, selectedIndustry);
      if (!primaryTrack || !sections.has(primaryTrack)) {
        generalRows.push(job);
        return;
      }

      sections.get(primaryTrack)?.push(job);
    });

    const orderedSections = selectedIndustryDefinition.tracks
      .map((track) => ({
        key: track.key,
        label: track.label,
        description: track.description,
        rows: sections.get(track.key) ?? [],
      }))
      .filter((section) => section.rows.length > 0);

    if (generalRows.length > 0) {
      orderedSections.push({
        key: "wider-market",
        label: `Wider ${selectedIndustryDefinition.label} roles`,
        description: "Relevant roles that fit this industry but not a narrower subfield keyword yet.",
        rows: generalRows,
      });
    }

    return orderedSections;
  }, [filteredJobs, selectedIndustry, selectedIndustryDefinition]);

  const toggle = (key: string) => {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  };

  if (!selectedIndustry || !selectedIndustryDefinition) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          That industry does not exist. Choose one from the industry selector page.
          <div className="mt-4">
            <Button asChild>
              <Link to="/app/jobs">Go to industry selector</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/app/jobs"
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Change industry
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {selectedIndustryDefinition.label} opportunities
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            This listing page only shows jobs, internships, and placements related to {selectedIndustryDefinition.label.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1.5">
            {scopedJobs.length} roles in this industry
          </span>
          {lastImportCount !== null ? (
            <span className="rounded-full border border-border bg-card px-3 py-1.5">
              Last refresh added {lastImportCount} role{lastImportCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
              tab === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setSelectedTrackKey(undefined)}
          className={cn(
            "rounded-2xl border px-4 py-3 text-left transition-colors",
            !selectedTrack
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          <div className="text-sm font-semibold">All {selectedIndustryDefinition.label} roles</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {filteredBeforeTrack.length} roles after the current filters
          </div>
        </button>
        {selectedIndustryDefinition.tracks.map((track) => (
          <button
            key={track.key}
            type="button"
            onClick={() => setSelectedTrackKey(track.key)}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              selectedTrackKey === track.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{track.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{track.description}</div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {trackCounts[track.key] ?? 0}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={`Search ${selectedIndustryDefinition.label.toLowerCase()} companies, roles, or keywords`}
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
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span> of {scopedJobs.length} roles
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={syncQuery}
            onChange={(event) => setSyncQuery(event.target.value)}
            placeholder={selectedIndustryDefinition.syncPlaceholder}
            className="sm:flex-1"
          />
          <Button type="button" onClick={syncFromJsearch} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            {selectedIndustryDefinition.syncLabel}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pull the latest roles into this industry page. Leave the query empty to use the curated {selectedIndustryDefinition.label.toLowerCase()} search bundle from the backend.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {selectedTrack
              ? `No ${selectedTrack.label.toLowerCase()} roles match your filters yet.`
              : selectedIndustryDefinition.emptyState}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left font-semibold w-[160px]">My Status</th>
                  <th className="px-3 py-3 text-left font-semibold w-[180px]">Company</th>
                  <th className="px-3 py-3 text-left font-semibold">Programme Name</th>
                  <th className="px-3 py-3 text-left font-semibold w-[110px]">Posted</th>
                  <th className="px-3 py-3 text-left font-semibold w-[110px]">Closing</th>
                  <th className="px-3 py-3 text-center font-semibold w-[60px]">CV</th>
                  <th className="px-3 py-3 text-center font-semibold w-[110px]">Cover Letter</th>
                </tr>
              </thead>
              <tbody>
                {groupedTracks.map((section) => {
                  const isCollapsed = collapsed[section.key];
                  return (
                    <TrackGroup
                      key={section.key}
                      label={section.label}
                      description={section.description}
                      rows={section.rows}
                      collapsed={!!isCollapsed}
                      onToggle={() => toggle(section.key)}
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

function TrackGroup({
  label,
  description,
  rows,
  collapsed,
  onToggle,
  saved,
}: {
  label: string;
  description: string;
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
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {label}
            <span className="ml-1 text-muted-foreground font-normal normal-case tracking-normal">
              ({rows.length})
            </span>
          </button>
          <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{description}</p>
        </td>
      </tr>
      {!collapsed && rows.map((job) => {
        const status = saved[job.id] ?? "Not Applied";
        const reqs = (job.requirements ?? "").toLowerCase();
        const needsCover = !reqs.includes("no cover letter");

        return (
          <tr
            key={job.id}
            className="group border-b border-border/50 transition-colors hover:bg-muted/30"
          >
            <td className={cn("px-3 py-2.5 text-xs", statusClass(status))}>
              {status}
            </td>
            <td className="px-3 py-2.5">
              <Link
                to="/app/jobs/$jobId"
                params={{ jobId: job.id }}
                className="font-medium text-primary hover:underline"
              >
                {job.company}
              </Link>
              <div className="text-[11px] text-muted-foreground">{job.location}</div>
            </td>
            <td className="px-3 py-2.5">
              <Link
                to="/app/jobs/$jobId"
                params={{ jobId: job.id }}
                className="text-foreground hover:text-primary hover:underline"
              >
                {job.role_title}
              </Link>
            </td>
            <td className="px-3 py-2.5 text-xs text-muted-foreground">
              {formatDate(getJobFreshnessDate(job))}
            </td>
            <td className={cn("px-3 py-2.5 text-xs", deadlineClass(job.deadline))}>
              {formatDate(job.deadline)}
            </td>
            <td className="px-3 py-2.5 text-center text-xs text-emerald-400">Yes</td>
            <td className="px-3 py-2.5 text-center text-xs">
              <span className={needsCover ? "text-emerald-400" : "text-muted-foreground"}>
                {needsCover ? "Yes" : "Optional"}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}