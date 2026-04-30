import { API_BASE_URL } from "@/lib/api/base-url";
import { getCsrfToken } from "@/lib/api/backend-session";

type Severity = "low" | "medium" | "high";

export interface CvAdvice {
  fit_score: number;
  summary: string;
  strengths: { point: string; evidence: string }[];
  gaps: { point: string; severity: Severity; how_to_address: string }[];
  edits: { location: string; current: string; suggested: string; why: string }[];
  keywords_to_add: string[];
}

interface AnalyseCvForJobResponse {
  id: string | null;
  advice: CvAdvice;
}

interface GenerateCoverLetterResponse {
  id: string;
  content: string;
}

type ToneOverrides = Partial<{
  directness: number;
  formality: number;
  confidence: number;
  detail_level: number;
  warmth: number;
  energy: number;
}>;

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

async function postJson<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
  const csrfToken = getCsrfToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed = parseJsonSafe(raw);

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !csrfToken) {
      throw new Error("Secure session is still initializing. Please try again.");
    }
    throw new Error(getErrorMessage(parsed, response.status));
  }

  return parsed as TResponse;
}

export function extractCvTextApi(cvId: string): Promise<{ text: string; length: number }> {
  return postJson<{ text: string; length: number }>("/cv/extract", { cvId });
}

export function analyseCvForJobApi(jobId: string): Promise<AnalyseCvForJobResponse> {
  return postJson<AnalyseCvForJobResponse>("/cv/analyse", { jobId });
}

export function generateCoverLetterApi(input: {
  jobId: string;
  toneOverrides?: ToneOverrides;
  extraContext?: string;
}): Promise<GenerateCoverLetterResponse> {
  const payload: Record<string, unknown> = { jobId: input.jobId };

  if (input.toneOverrides && Object.keys(input.toneOverrides).length > 0) {
    payload.toneOverrides = input.toneOverrides;
  }
  if (input.extraContext) {
    payload.extraContext = input.extraContext;
  }

  return postJson<GenerateCoverLetterResponse>("/cover-letters/generate", payload);
}
