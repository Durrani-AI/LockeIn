import { API_BASE_URL } from "@/lib/api/base-url";
import { getCsrfToken } from "@/lib/api/backend-session";

export interface SyncedJob {
  id: string;
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string | null;
}

export interface SyncJobsResponse {
  query: string;
  fetched: number;
  imported: number;
  jobs: SyncedJob[];
}

function parseJsonSafe(raw: string): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessage(parsed: unknown, statusCode: number): string {
  if (!parsed || typeof parsed !== "object") {
    return `Request failed (${statusCode})`;
  }

  const payload = parsed as { detail?: unknown; message?: unknown; error?: unknown };
  if (typeof payload.detail === "string" && payload.detail) {
    return payload.detail;
  }
  if (typeof payload.message === "string" && payload.message) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error) {
    return payload.error;
  }

  return `Request failed (${statusCode})`;
}

export async function syncJobsFromJsearchApi(input: {
  query?: string;
  page?: number;
  numPages?: number;
}): Promise<SyncJobsResponse> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE_URL}/jobs/sync`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  const parsed = parseJsonSafe(raw);

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !csrfToken) {
      throw new Error("Secure session is still initializing. Please try again.");
    }
    throw new Error(getErrorMessage(parsed, response.status));
  }

  return parsed as SyncJobsResponse;
}
