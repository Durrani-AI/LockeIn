# Contributing to LockedIn

Thanks for your interest in contributing. This guide covers how to set up the project locally and the conventions we follow.

---

## Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.12+** and **pip**
- A [Supabase](https://supabase.com) project (free tier)
- A [Groq](https://console.groq.com) API key (free tier)

---

## Local Setup

### Frontend

```bash
cp .env.example .env       # populate Supabase + API values
npm install
npm run dev                # http://localhost:5173
```

### Backend

```bash
cd backend-fastapi
cp .env.example .env       # populate all required keys
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The Vite dev server proxies `/api/v1` to `localhost:8000` automatically.

---

## Coding Conventions

### Frontend (TypeScript / React)

- **Formatting:** Prettier (tabs, double quotes, 110 char width) — run via `npm run lint`.
- **Imports:** Use the `@/` path alias for all project imports.
- **Components:** Only add shadcn/ui components you actually use (`npx shadcn@latest add <name>`).
- **API calls:** Use the client modules in `src/lib/api/`. Never call `fetch()` directly from pages.
- **Sanitisation:** All user input must pass through `src/lib/security/sanitize.ts` before display or storage.

### Backend (Python / FastAPI)

- **Config:** All environment variables go through `app/core/config.py` — no `os.getenv()` in route files.
- **Sanitisation:** All external input (user, API, AI output) passes through `app/core/sanitization.py`.
- **Auth:** Every mutating endpoint must declare `Depends(get_request_context)` explicitly.
- **Rate limiting:** Use `Depends(rate_limit(...))` for authenticated endpoints. Use `_enforce_ip_rate_limit()` for pre-auth endpoints.
- **Schemas:** Request/response models live in `app/models/schemas.py` with Pydantic validation.

### General

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- One logical change per commit.
- The project name is **LockedIn** (not LockeIn).

---

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes and verify the build passes (`npm run build`).
3. Push and open a PR with a clear description of what changed and why.
4. At least one review before merging.
