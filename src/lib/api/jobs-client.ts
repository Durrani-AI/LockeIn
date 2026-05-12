import { API_BASE_URL } from "@/lib/api/base-url";
import { getCsrfToken } from "@/lib/api/backend-session";
import { getErrorMessage, getNetworkFailureMessage, parseJsonSafe } from "@/lib/api/http-helpers";

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


export async function syncJobsFromJsearchApi(input: {
  query?: string;
  page?: number;
  numPages?: number;
  industry?: "technology" | "finance" | "law" | "engineering-science";
}): Promise<SyncJobsResponse> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/jobs/sync`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(getNetworkFailureMessage());
  }

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
