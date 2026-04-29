import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");

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

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error("Could not read auth session");
  }

  const token = data.session?.access_token;
  if (!token) {
    throw new Error("You are not signed in.");
  }

  return token;
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
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed = parseJsonSafe(raw);

  if (!response.ok) {
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
