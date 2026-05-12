import { API_BASE_URL } from "@/lib/api/base-url";
import { getErrorMessage, parseJsonSafe } from "@/lib/api/http-helpers";

interface CreateSessionResponse {
  userId: string;
  csrfToken: string;
}

const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || "lockedin_csrf_token";

let csrfToken: string | null = null;
let syncedAccessToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));

  if (!entry) {
    return null;
  }

  const rawValue = entry.slice(prefix.length).trim();
  if (!rawValue) {
    return null;
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}


export function getCsrfToken(): string | null {
  return csrfToken || readCookie(CSRF_COOKIE_NAME);
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
  const existingCsrfToken = getCsrfToken();
  if (!existingCsrfToken && !syncedAccessToken) {
    csrfToken = null;
    return;
  }

  const headers: Record<string, string> = {};
  if (existingCsrfToken) {
    headers["X-CSRF-Token"] = existingCsrfToken;
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
