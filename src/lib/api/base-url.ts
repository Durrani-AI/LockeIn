const defaultApiHost = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
const defaultApiBaseUrl = `http://${defaultApiHost}:8000/api/v1`;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(
  /\/+$/,
  "",
);
