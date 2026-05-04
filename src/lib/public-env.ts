export type PublicRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  API_BASE_URL?: string;
};

declare global {
  interface Window {
    __LOCKEDIN_PUBLIC_ENV__?: PublicRuntimeEnv;
  }
}

export function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getBrowserRuntimeEnv(): PublicRuntimeEnv | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__LOCKEDIN_PUBLIC_ENV__;
}

export function getServerRuntimeEnv(): PublicRuntimeEnv {
  if (typeof process === "undefined") return {};

  return {
    SUPABASE_URL: cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY: cleanEnvValue(
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ),
    API_BASE_URL: cleanEnvValue(process.env.VITE_API_BASE_URL || process.env.API_BASE_URL),
  };
}
