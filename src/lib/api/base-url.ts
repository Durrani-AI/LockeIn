import { cleanEnvValue, getBrowserRuntimeEnv } from "@/lib/public-env";

const defaultApiHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const defaultApiBaseUrl = `http://${defaultApiHost}:8000/api/v1`;

const runtimeEnv = getBrowserRuntimeEnv();
const configuredApiBaseUrl =
  cleanEnvValue(import.meta.env.VITE_API_BASE_URL) ||
  cleanEnvValue(runtimeEnv?.API_BASE_URL);

export const API_BASE_URL = (configuredApiBaseUrl || defaultApiBaseUrl).replace(
  /\/+$/,
  "",
);
