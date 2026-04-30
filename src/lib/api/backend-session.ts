import { API_BASE_URL } from "@/lib/api/base-url";

interface CreateSessionResponse {
  userId: string;
  csrfToken: string;
}

let csrfToken: string | null = null;
let syncedAccessToken: string | null = null;

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

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function syncBackendSession(accessToken: string): Promise<void> {
  if (!accessToken) {
    throw new Error("Missing access token for backend session sync");
  }

  if (syncedAccessToken === accessToken && csrfToken) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const raw = await response.text();
  const parsed = parseJsonSafe(raw);

  if (!response.ok) {
    throw new Error(getErrorMessage(parsed, response.status));
  }

  const payload = parsed as Partial<CreateSessionResponse> | null;
  if (!payload?.csrfToken) {
    throw new Error("Backend session sync failed: missing CSRF token");
  }

  csrfToken = payload.csrfToken;
  syncedAccessToken = accessToken;
}

export async function clearBackendSession(options?: { bestEffort?: boolean }): Promise<void> {
  const headers: Record<string, string> = {};
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/session`, {
      method: "DELETE",
      credentials: "include",
      headers,
    });

    if (!response.ok && !options?.bestEffort) {
      const raw = await response.text();
      const parsed = parseJsonSafe(raw);
      throw new Error(getErrorMessage(parsed, response.status));
    }
  } catch (error) {
    if (!options?.bestEffort) {
      throw error;
    }
  } finally {
    csrfToken = null;
    syncedAccessToken = null;
  }
}
