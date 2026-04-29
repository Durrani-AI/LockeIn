# LockedIn FastAPI Backend (Migration Workstream)

This service is the first implementation slice for migrating backend logic from TypeScript server functions to FastAPI.

## Current Scope

- Contract-parity endpoints for:
  - `POST /api/v1/cv/extract`
  - `POST /api/v1/cv/analyse`
  - `POST /api/v1/cover-letters/generate`
- Supabase bearer-token auth verification.
- Supabase PostgREST and Storage operations.
- PDF extraction via PyMuPDF.
- AI pipeline scaffolding using Groq + LangChain + sentence-transformers.

## Setup

1. Create and activate a Python virtual environment.
2. Install base dependencies:

```bash
pip install -r requirements.txt
```

3. Optional (recommended for higher-quality semantic matching):

```bash
pip install -r requirements-ml.txt
```

4. Copy env template and populate values:

```bash
cp .env.example .env
```

5. Run locally:

```bash
uvicorn app.main:app --reload --port 8000
```

## Health Check

- `GET /api/v1/health`

## Notes

- The existing frontend remains unchanged while this backend is introduced.
- API contract baseline is documented in `docs/migration/api-contract-v1.md`.
