import { cleanEnvValue, getBrowserRuntimeEnv } from "@/lib/public-env";

// In the browser, default to a relative path so requests go through the Vite
// dev proxy (or any production reverse proxy) instead of directly hitting port 8000.
// On the server (SSR), we can reach the backend at 127.0.0.1:8000 directly.
const isBrowser = typeof window !== "undefined";
const defaultApiBaseUrl = isBrowser ? "/api/v1" : "http://127.0.0.1:8000/api/v1";

const runtimeEnv = getBrowserRuntimeEnv();
const configuredApiBaseUrl =
  cleanEnvValue(import.meta.env.VITE_API_BASE_URL) ||
  cleanEnvValue(runtimeEnv?.API_BASE_URL);

export const API_BASE_URL = (configuredApiBaseUrl || defaultApiBaseUrl).replace(
  /\/+$/,
  "",
);
