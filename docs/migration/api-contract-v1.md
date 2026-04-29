# API Contract Freeze (v1)

This document captures the current backend contract from the TypeScript server functions so the FastAPI migration can preserve behavior.

## Auth

- All protected endpoints require:
  - `Authorization: Bearer <supabase_access_token>`
- Token is validated against Supabase Auth.

## Endpoint: Extract CV Text

- Method: `POST`
- Path: `/api/v1/cv/extract`
- Request:

```json
{
  "cvId": "uuid"
}
```

- Success response:

```json
{
  "text": "<cleaned extracted cv text>",
  "length": 12345
}
```

- Error semantics:
  - `404` when CV not found
  - `403` when CV does not belong to authenticated user
  - `400` when file cannot be downloaded or parsed
  - `500` when text cannot be persisted

## Endpoint: Analyse CV For Job

- Method: `POST`
- Path: `/api/v1/cv/analyse`
- Request:

```json
{
  "jobId": "uuid"
}
```

- Success response:

```json
{
  "id": "<cv_advice row id or null>",
  "advice": {
    "fit_score": 78,
    "summary": "...",
    "strengths": [{ "point": "...", "evidence": "..." }],
    "gaps": [{ "point": "...", "severity": "low|medium|high", "how_to_address": "..." }],
    "edits": [{ "location": "...", "current": "...", "suggested": "...", "why": "..." }],
    "keywords_to_add": ["..."]
  }
}
```

- Error semantics:
  - `400` when CV missing or not yet parsed
  - `404` when job not found
  - `502` when AI provider returns invalid output

## Endpoint: Generate Cover Letter

- Method: `POST`
- Path: `/api/v1/cover-letters/generate`
- Request:

```json
{
  "jobId": "uuid",
  "toneOverrides": {
    "directness": 1,
    "formality": 1,
    "confidence": 1,
    "detail_level": 1,
    "warmth": 1,
    "energy": 1
  },
  "extraContext": "optional string"
}
```

- Success response:

```json
{
  "id": "<cover_letters row id>",
  "content": "<cover letter text>"
}
```

- Error semantics:
  - `400` when CV missing/unparsed or communication profile missing
  - `404` when job not found
  - `502` when AI provider returns empty output
  - `500` when insert fails

## Compatibility Rules

- Keep field names stable (`fit_score`, `keywords_to_add`, `toneOverrides`, `extraContext`).
- Keep auth model bearer-token based.
- Keep Supabase table writes to `cv_advice` and `cover_letters`.
- UI redesign is out of scope for migration.
