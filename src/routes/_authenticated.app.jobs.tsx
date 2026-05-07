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
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { syncJobsFromJsearchApi } from "@/lib/api/jobs-client";

export const Route = createFileRoute("/_authenticated/app/jobs")({
  validateSearch: (search: Record<string, unknown>) => ({
    industry: parseIndustry(search.industry),
    track: typeof search.track === "string" && search.track.trim() ? search.track.trim() : undefined,
  }),
  component: JobsPage,
});

type Category = "finance" | "technology" | "law" | "graduate";
type JobType = "internship" | "placement" | "graduate";
type Industry = "technology" | "finance" | "law" | "consulting" | "graduate";
type JobsSearch = {
  industry?: Industry;
  track?: string;
};

interface TrackDefinition {
  key: string;
  label: string;
  description: string;
  keywords: string[];
}

interface IndustryDefinition {
  key: Industry;
  label: string;
  description: string;
  note: string;
  accentClass: string;
  mappedCategories: Category[];
  matchKeywords?: string[];
  excludeKeywords?: string[];
  emptyState: string;
  syncLabel: string;
  syncPlaceholder: string;
  tracks: TrackDefinition[];
}

interface JobRow {
  id: string;
  company: string;
  role_title: string;
  category: Category;
  job_type: JobType;
  location: string;
  deadline: string | null;
  created_at: string;
  posted_at: string | null;
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
const AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT = 28;

const INDUSTRY_ORDER: Industry[] = ["technology", "finance", "law", "consulting", "graduate"];
const CONSULTING_KEYWORDS = [
  "consulting",
  "consultant",
  "advisory",
  "strategy",
  "transformation",
  "operations consulting",
  "management consulting",
  "risk advisory",
];
const LEGAL_KEYWORDS = [
  "law",
  "legal",
  "solicitor",
  "paralegal",
  "training contract",
  "vacation scheme",
  "disputes",
  "litigation",
];

const INDUSTRY_DEFINITIONS: Record<Industry, IndustryDefinition> = {
  technology: {
    key: "technology",
    label: "Technology",
    description: "Software, AI, cloud, cyber, platform, and infrastructure roles.",
    note: "Designed for students targeting engineering-led internships, placements, and graduate schemes.",
    accentClass: "border-sky-500/30 bg-sky-500/10",
    mappedCategories: ["technology"],
    emptyState: "No technology roles match this mix of filters yet.",
    syncLabel: "Refresh technology feed",
    syncPlaceholder: "Optional query for technology roles, for example machine learning internship united kingdom",
    tracks: [
      {
        key: "software-engineering",
        label: "Software Engineering",
        description: "Frontend, backend, full-stack, mobile, and platform product engineering.",
        keywords: ["software", "frontend", "backend", "full stack", "full-stack", "developer", "mobile", "platform engineer"],
      },
      {
        key: "ai-data",
        label: "AI & Data",
        description: "Machine learning, applied AI, data science, analytics, and data engineering.",
        keywords: ["machine learning", "artificial intelligence", "ai", "ml", "data scientist", "data science", "data engineer", "analytics"],
      },
      {
        key: "cloud-platform",
        label: "Cloud & Platform",
        description: "Cloud engineering, DevOps, SRE, infrastructure, and Kubernetes-focused roles.",
        keywords: ["cloud", "devops", "site reliability", "sre", "infrastructure", "kubernetes", "azure", "aws", "gcp"],
      },
      {
        key: "cyber-network",
        label: "Cyber & Network",
        description: "Cybersecurity, network engineering, SOC, and security operations roles.",
        keywords: ["cyber", "security", "network", "soc", "security operations", "information security"],
      },
    ],
  },
  finance: {
    key: "finance",
    label: "Finance",
    description: "Banking, markets, asset management, risk, and fintech-adjacent roles.",
    note: "Useful for finance, economics, and quantitative applicants tracking deadline-heavy programmes.",
    accentClass: "border-emerald-500/30 bg-emerald-500/10",
    mappedCategories: ["finance"],
    emptyState: "No finance roles match your current filters.",
    syncLabel: "Refresh finance feed",
    syncPlaceholder: "Optional query for finance roles, for example investment banking internship united kingdom",
    tracks: [
      {
        key: "investment-banking",
        label: "Investment Banking",
        description: "Summer analyst, M&A, corporate finance, and banking programmes.",
        keywords: ["investment banking", "summer analyst", "m&a", "corporate finance", "banking analyst"],
      },
      {
        key: "markets-trading",
        label: "Markets & Trading",
        description: "Sales and trading, research, and global markets roles.",
        keywords: ["trading", "markets", "sales and trading", "equity research", "fixed income"],
      },
      {
        key: "asset-management",
        label: "Asset Management",
        description: "Investment management, wealth, pensions, and portfolio roles.",
        keywords: ["asset management", "investment management", "wealth", "portfolio", "pensions"],
      },
      {
        key: "risk-compliance",
        label: "Risk & Compliance",
        description: "Risk, audit, controls, and regulatory roles across finance teams.",
        keywords: ["risk", "compliance", "audit", "controls", "regulatory"],
      },
    ],
  },
  law: {
    key: "law",
    label: "Law",
    description: "Training contracts, vacation schemes, legal operations, and commercial law roles.",
    note: "Keeps legal opportunities separate from advisory-heavy consulting work.",
    accentClass: "border-amber-500/30 bg-amber-500/10",
    mappedCategories: ["law"],
    matchKeywords: LEGAL_KEYWORDS,
    emptyState: "No legal roles match the selected filters right now.",
    syncLabel: "Refresh law feed",
    syncPlaceholder: "Optional query for law roles, for example law vacation scheme united kingdom",
    tracks: [
      {
        key: "training-contracts",
        label: "Training Contracts",
        description: "Training contract and solicitor pathway roles.",
        keywords: ["training contract", "trainee solicitor", "solicitor"],
      },
      {
        key: "vacation-schemes",
        label: "Vacation Schemes",
        description: "Vacation scheme and insight week opportunities.",
        keywords: ["vacation scheme", "vac scheme", "insight week"],
      },
      {
        key: "commercial-law",
        label: "Commercial Law",
        description: "Corporate, disputes, competition, and commercial law roles.",
        keywords: ["commercial", "corporate", "disputes", "litigation", "competition"],
      },
      {
        key: "legal-operations",
        label: "Legal Operations",
        description: "Compliance, legal operations, and regulatory legal roles.",
        keywords: ["legal operations", "compliance", "regulatory", "paralegal"],
      },
    ],
  },
  consulting: {
    key: "consulting",
    label: "Consulting",
    description: "Strategy, advisory, transformation, operations, and risk consulting pathways.",
    note: "A separate view for consulting firms and advisory graduate programmes.",
    accentClass: "border-violet-500/30 bg-violet-500/10",
    mappedCategories: ["law", "graduate"],
    matchKeywords: CONSULTING_KEYWORDS,
    emptyState: "No consulting roles match the selected filters yet.",
    syncLabel: "Refresh consulting feed",
    syncPlaceholder: "Optional query for consulting roles, for example strategy consulting internship united kingdom",
    tracks: [
      {
        key: "strategy",
        label: "Strategy",
        description: "Corporate strategy, growth, and strategy consulting roles.",
        keywords: ["strategy", "corporate strategy", "growth"],
      },
      {
        key: "management",
        label: "Management Consulting",
        description: "Generalist consulting, business analysis, and management advisory roles.",
        keywords: ["management consulting", "business analyst", "consultant"],
      },
      {
        key: "operations",
        label: "Operations & Transformation",
        description: "Transformation, process improvement, operations, and change roles.",
        keywords: ["transformation", "operations", "change", "process improvement"],
      },
      {
        key: "risk-advisory",
        label: "Risk Advisory",
        description: "Risk, controls, technology advisory, and regulatory consulting.",
        keywords: ["risk advisory", "technology advisory", "controls", "governance", "forensic"],
      },
    ],
  },
  graduate: {
    key: "graduate",
    label: "General Graduate",
    description: "Broader rotational and business graduate programmes outside specialist tracks.",
    note: "A catch-all for cross-functional schemes, public sector programmes, and wider commercial roles.",
    accentClass: "border-rose-500/30 bg-rose-500/10",
    mappedCategories: ["graduate"],
    excludeKeywords: CONSULTING_KEYWORDS,
    emptyState: "No broad graduate schemes match those filters yet.",
    syncLabel: "Refresh graduate feed",
    syncPlaceholder: "Optional query for graduate roles, for example commercial graduate scheme united kingdom",
    tracks: [
      {
        key: "commercial",
        label: "Commercial",
        description: "Commercial, growth, account, and revenue-facing graduate pathways.",
        keywords: ["commercial", "sales", "account", "business development", "revenue"],
      },
      {
        key: "operations",
        label: "Business Operations",
        description: "Operations, logistics, programme, and business support graduate schemes.",
        keywords: ["operations", "logistics", "programme", "program", "business support"],
      },
      {
        key: "public-sector",
        label: "Public Sector",
        description: "Civil service, public sector, and non-profit graduate pathways.",
        keywords: ["civil service", "public sector", "government", "policy", "non-profit"],
      },
      {
        key: "rotational",
        label: "Rotational Programmes",
        description: "Multi-team graduate schemes and rotational development programmes.",
        keywords: ["rotational", "rotation", "graduate programme", "graduate scheme"],
      },
    ],
  },
};

function parseIndustry(value: unknown): Industry | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return INDUSTRY_ORDER.includes(value as Industry) ? (value as Industry) : undefined;
}

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

function getJobFreshnessDate(job: Pick<JobRow, "posted_at" | "created_at">) {
  return job.posted_at ?? job.created_at;
}

function compareJobsByFreshness(left: JobRow, right: JobRow) {
  return new Date(getJobFreshnessDate(right)).getTime() - new Date(getJobFreshnessDate(left)).getTime();
}

function getJobText(job: Pick<JobRow, "company" | "role_title" | "location" | "short_summary" | "requirements">) {
  return `${job.company} ${job.role_title} ${job.location} ${job.short_summary} ${job.requirements ?? ""}`.toLowerCase();
}

function matchesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function jobMatchesIndustry(job: JobRow, industry: Industry) {
  const definition = INDUSTRY_DEFINITIONS[industry];
  if (!definition.mappedCategories.includes(job.category)) {
    return false;
  }

  const text = getJobText(job);
  if (definition.matchKeywords && !matchesAnyKeyword(text, definition.matchKeywords)) {
    return false;
  }

  if (definition.excludeKeywords && matchesAnyKeyword(text, definition.excludeKeywords)) {
    return false;
  }

  return true;
}

function getTrackDefinition(industry: Industry, trackKey: string | undefined) {
  if (!trackKey) {
    return undefined;
  }

  return INDUSTRY_DEFINITIONS[industry].tracks.find((track) => track.key === trackKey);
}

function jobMatchesTrack(job: JobRow, industry: Industry, trackKey: string) {
  const track = getTrackDefinition(industry, trackKey);
  if (!track) {
    return true;
  }

  return matchesAnyKeyword(getJobText(job), track.keywords);
}

function getPrimaryTrack(job: JobRow, industry: Industry) {
  const text = getJobText(job);
  return INDUSTRY_DEFINITIONS[industry].tracks.find((track) => matchesAnyKeyword(text, track.keywords))?.key ?? null;
}

function getLatestJobDate(jobs: JobRow[]) {
  return jobs.length > 0 ? getJobFreshnessDate(jobs[0]) : null;
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
  const search = Route.useSearch() as JobsSearch;
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selectedIndustry = search.industry;
  const selectedIndustryDefinition = selectedIndustry ? INDUSTRY_DEFINITIONS[selectedIndustry] : null;
  const selectedTrack = selectedIndustry ? getTrackDefinition(selectedIndustry, search.track) : undefined;

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
    async ({ query, manual, industry }: { query?: string; manual: boolean; industry?: Industry }) => {
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

        const scopeLabel = industry ? INDUSTRY_DEFINITIONS[industry].label.toLowerCase() : "market";

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
    await runSync({ query: syncQuery, manual: true, industry: selectedIndustry });
  };

  const scopedJobs = useMemo(() => {
    if (!selectedIndustry) {
      return jobs;
    }

    return jobs.filter((job) => jobMatchesIndustry(job, selectedIndustry));
  }, [jobs, selectedIndustry]);

  useEffect(() => {
    if (!user || loading || syncing) return;
    if (typeof window === "undefined") return;

    const minimumJobCount = selectedIndustry ? AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT : AUTO_SYNC_MIN_JOB_COUNT;
    if (scopedJobs.length >= minimumJobCount) return;

    const storageKey = `${AUTO_SYNC_STORAGE_KEY}:${selectedIndustry ?? "all"}`;
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
        const searchValue = searchText.toLowerCase();
        const haystack = getJobText(job);
        if (!haystack.includes(searchValue)) {
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
    if (!selectedIndustry || !selectedTrack) {
      return filteredBeforeTrack;
    }

    return filteredBeforeTrack.filter((job) => jobMatchesTrack(job, selectedIndustry, selectedTrack.key));
  }, [filteredBeforeTrack, selectedIndustry, selectedTrack]);

  const trackCounts = useMemo(() => {
    if (!selectedIndustryDefinition) {
      return {} as Record<string, number>;
    }

    const counts: Record<string, number> = {};
    selectedIndustryDefinition.tracks.forEach((track) => {
      counts[track.key] = filteredBeforeTrack.filter((job) => jobMatchesTrack(job, selectedIndustryDefinition.key, track.key)).length;
    });
    return counts;
  }, [filteredBeforeTrack, selectedIndustryDefinition]);

  const groupedTracks = useMemo(() => {
    if (!selectedIndustryDefinition) {
      return [] as Array<{ key: string; label: string; description: string; rows: JobRow[] }>;
    }

    const sections = new Map<string, JobRow[]>();
    selectedIndustryDefinition.tracks.forEach((track) => sections.set(track.key, []));
    const generalRows: JobRow[] = [];

    filteredJobs.forEach((job) => {
      const primaryTrack = getPrimaryTrack(job, selectedIndustryDefinition.key);
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
        description: "Relevant roles that fit the chosen industry but not a narrower track keyword yet.",
        rows: generalRows,
      });
    }

    return orderedSections;
  }, [filteredJobs, selectedIndustryDefinition]);

  const industrySummaries = useMemo(() => {
    return INDUSTRY_ORDER.map((industry) => {
      const matchingJobs = jobs.filter((job) => jobMatchesIndustry(job, industry));
      return {
        definition: INDUSTRY_DEFINITIONS[industry],
        count: matchingJobs.length,
        latestDate: getLatestJobDate(matchingJobs),
      };
    });
  }, [jobs]);

  const latestScopedDate = useMemo(() => getLatestJobDate(scopedJobs), [scopedJobs]);

  const toggle = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));

  // This route has a nested child (/app/jobs/$jobId). Render it when active.
  if (/^\/app\/jobs\/[^/]+$/.test(location.pathname)) {
    return <Outlet />;
  }

  if (!selectedIndustryDefinition) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card px-6 py-7 shadow-soft sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Browse live roles
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Choose the industry you want to target first.
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Pick a market and LockedIn will open a dedicated feed for that industry, already split into the role families that matter most there.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-3 py-1.5">
              Latest-first ordering when posting dates are available
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5">
              Live catalog powered by JSearch imports
            </span>
            {lastImportCount !== null ? (
              <span className="rounded-full border border-border bg-background px-3 py-1.5">
                Last refresh added {lastImportCount} role{lastImportCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {industrySummaries.map(({ definition, count, latestDate }) => (
              <Link
                key={definition.key}
                to="/app/jobs"
                search={{ industry: definition.key }}
                className={cn(
                  "group rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-soft",
                  definition.accentClass,
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                      {definition.label}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">{definition.description}</p>
                  </div>
                  <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
                    {count} roles
                  </span>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{definition.note}</p>
                <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{latestDate ? `Newest posting ${formatDate(latestDate)}` : "Awaiting next import"}</span>
                  <span className="font-medium text-foreground group-hover:text-primary">Open feed</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              value={syncQuery}
              onChange={(event) => setSyncQuery(event.target.value)}
              placeholder="Optional query to force a narrower market refresh"
              className="lg:flex-1"
            />
            <Button type="button" onClick={syncFromJsearch} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh full market feed
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Leave the query empty to refresh the shared jobs catalog across technology, finance, law, consulting, and general graduate roles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/app/jobs"
            search={{}}
            className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Change industry
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {selectedIndustryDefinition.label} roles
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            {selectedIndustryDefinition.description} Filter the feed by programme type, application status, or specialist track before opening any role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1.5">
            {scopedJobs.length} roles in this industry
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1.5">
            {latestScopedDate ? `Newest posting ${formatDate(latestScopedDate)}` : "Waiting for next refresh"}
          </span>
          {lastImportCount !== null ? (
            <span className="rounded-full border border-border bg-card px-3 py-1.5">
              Last refresh added {lastImportCount} role{lastImportCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link
          to="/app/jobs"
          search={{ industry: selectedIndustry }}
          className={cn(
            "rounded-2xl border px-4 py-3 text-left transition-colors",
            !selectedTrack
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          <div className="text-sm font-semibold">All {selectedIndustryDefinition.label} tracks</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {filteredBeforeTrack.length} roles after the current top-level filters
          </div>
        </Link>
        {selectedIndustryDefinition.tracks.map((track) => (
          <Link
            key={track.key}
            to="/app/jobs"
            search={{ industry: selectedIndustry, track: track.key }}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              selectedTrack?.key === track.key
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
          </Link>
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
              {filteredJobs.length}
            </span>{" "}
            of {scopedJobs.length} {selectedIndustryDefinition.label.toLowerCase()} roles
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
          Pull the latest roles into this industry feed. Leave the query empty to use the curated {selectedIndustryDefinition.label.toLowerCase()} search bundle from the backend.
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
                    Posted
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
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {label}
            <span className="ml-1 text-muted-foreground font-normal normal-case tracking-normal">
              ({rows.length})
            </span>
          </button>
          <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{description}</p>
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
                {formatDate(getJobFreshnessDate(j))}
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
