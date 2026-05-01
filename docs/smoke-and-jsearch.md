# Smoke Test + JSearch Setup

## 1) Backend env setup

Populate `backend-fastapi/.env` from `backend-fastapi/.env.example`:

- `GROQ_API_KEY` (required for full personalized letter generation)
- `SUPABASE_SERVICE_ROLE_KEY` (required for job sync upserts)
- `RAPIDAPI_KEY` (required for JSearch requests)
- `APP_ALLOWED_ORIGINS` should include your exact frontend origin (`localhost` vs `127.0.0.1`)

Then restart backend:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 2) JSearch sync from UI

1. Open `/app/jobs`.
2. Use **Import from JSearch**.
3. Optional query can be provided; if omitted, backend uses `JSEARCH_DEFAULT_QUERY`.

Imported jobs are upserted into Supabase `jobs` and continue to work with:

- saved job statuses
- `/app/jobs/:jobId` detail route
- CV advice and cover-letter generation

## 3) Smoke test setup

Use `tests/smoke/.env.example` as reference and set env vars in your terminal:

- `LOCKEDIN_E2E_BASE_URL`
- `LOCKEDIN_E2E_EMAIL`
- `LOCKEDIN_E2E_PASSWORD`
- `LOCKEDIN_E2E_CV_PATH` (required only if account has no parsed CV)
- `LOCKEDIN_E2E_JSEARCH_QUERY` (optional)
- `LOCKEDIN_E2E_REQUIRE_GROQ=true` to fail if fallback copy is returned

Install browsers once:

```bash
npx playwright install chromium
```

Run smoke test:

```bash
npm run test:smoke
```
