import { API_BASE_URL } from "@/lib/api/base-url";

/**
 * Safely parse a JSON string without throwing.
 * Returns `null` for empty or malformed input.
 */
export function parseJsonSafe(raw: string): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Extract a human-readable error message from a parsed API error body.
 * Checks `detail`, `message`, and `error` fields in that order.
 */
export function getErrorMessage(parsed: unknown, statusCode: number): string {
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

/**
 * Produce a descriptive message when a network request to the backend fails entirely.
 */
export function getNetworkFailureMessage(): string {
  return `Could not reach backend API at ${API_BASE_URL}. Please confirm the backend is running and APP_ALLOWED_ORIGINS includes this frontend domain.`;
}
