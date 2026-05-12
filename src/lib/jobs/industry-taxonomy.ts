/**
 * industry-logic.ts  (re-exported as industry-taxonomy.ts for backwards compat)
 *
 * Filtering, matching, sorting, and display-helper functions that operate
 * on the static data defined in ./industry-data.ts.
 */

// Re-export every data type and constant so existing import sites don't break.
export {
  AUTO_SYNC_MIN_INDUSTRY_JOB_COUNT,
  AUTO_SYNC_MIN_INTERVAL_MS,
  AUTO_SYNC_STORAGE_KEY,
  INDUSTRY_DEFINITIONS,
  INDUSTRY_ORDER,
  STATUS_OPTIONS,
  TYPE_TABS,
  type Category,
  type Industry,
  type IndustryDefinition,
  type JobRow,
  type JobType,
  type SavedRow,
  type TrackDefinition,
} from "@/lib/jobs/industry-data";

import {
  INDUSTRY_DEFINITIONS,
  INDUSTRY_ORDER,
  type Industry,
  type JobRow,
} from "@/lib/jobs/industry-data";

// ── Parsing ────────────────────────────────────────────────────────

export function parseIndustry(value: unknown): Industry | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return INDUSTRY_ORDER.includes(value as Industry) ? (value as Industry) : undefined;
}

export function getTrackDefinition(industry: Industry, trackKey: string | undefined) {
  if (!trackKey) {
    return undefined;
  }

  return INDUSTRY_DEFINITIONS[industry].tracks.find((track) => track.key === trackKey);
}

// ── Job text helpers ───────────────────────────────────────────────

export function getJobFreshnessDate(job: Pick<JobRow, "posted_at" | "created_at">) {
  return job.posted_at ?? job.created_at;
}

export function compareJobsByFreshness(left: JobRow, right: JobRow) {
  return new Date(getJobFreshnessDate(right)).getTime() - new Date(getJobFreshnessDate(left)).getTime();
}

export function getJobText(job: Pick<JobRow, "company" | "role_title" | "location" | "short_summary" | "requirements">) {
  return `${job.company} ${job.role_title} ${job.location} ${job.short_summary} ${job.requirements ?? ""}`.toLowerCase();
}

export function getLatestJobDate(jobs: JobRow[]) {
  return jobs.length > 0 ? getJobFreshnessDate(jobs[0]) : null;
}

// ── Keyword matching ───────────────────────────────────────────────

function matchesAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function jobMatchesIndustry(job: JobRow, industry: Industry) {
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

export function jobMatchesTrack(job: JobRow, industry: Industry, trackKey: string) {
  const track = getTrackDefinition(industry, trackKey);
  if (!track) {
    return true;
  }

  return matchesAnyKeyword(getJobText(job), track.keywords);
}

export function getPrimaryTrack(job: JobRow, industry: Industry) {
  const text = getJobText(job);
  return INDUSTRY_DEFINITIONS[industry].tracks.find((track) => matchesAnyKeyword(text, track.keywords))?.key ?? null;
}

// ── Display helpers ────────────────────────────────────────────────

export function statusClass(status: string | null | undefined) {
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

export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function deadlineClass(d: string | null) {
  if (!d) return "text-muted-foreground";
  const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-muted-foreground line-through";
  if (days < 14) return "text-amber-400 font-medium";
  return "text-foreground";
}