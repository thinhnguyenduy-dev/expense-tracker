# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack expense management app implementing T. Harv Eker's 6 Jars money methodology. Backend: FastAPI + SQLAlchemy + PostgreSQL. Frontend: Next.js 16 (App Router) + TypeScript + shadcn/ui. Includes a LangGraph-based AI financial analyst agent.

## Commands

### Backend

```bash
cd backend
source venv/bin/activate

# Run dev server
uvicorn main:app --reload

# Run migrations
alembic upgrade head

# Create new migration after model changes
alembic revision --autogenerate -m "description"

# Seed test data
python seed.py --users 2 --months 3 --verbose
```

### Frontend

```bash
cd frontend

npm install       # install dependencies
npm run dev       # start dev server (localhost:3000)
npm run build     # production build
npm run lint      # ESLint
```

### Environment

```bash
# Backend env at backend/.env (copy from backend/.env.example)
# Required: DATABASE_URL, JWT_SECRET
# Optional: REDIS_URL, SENTRY_DSN, SMTP_HOST, ELASTICSEARCH_URL, OPENAI_API_KEY, GOOGLE_API_KEY, ANTHROPIC_API_KEY

# Frontend env: NEXT_PUBLIC_API_URL (default: http://localhost:8000)
```

## Architecture

### Backend (`backend/`)

- `main.py` — FastAPI app entry, registers all routers, CORS, rate limiting, APScheduler (recurring expense job: 1h, bill reminders: 24h)
- `app/core/` — config (pydantic-settings), database (SQLAlchemy engine/session), security (JWT/bcrypt), deps (auth dependency injected into all protected routes), logging (Loguru + optional ELK)
- `app/models/` — SQLAlchemy models: User, Category, Expense, Income, Goal, Jar, Transfer, Family, RecurringExpense
- `app/schemas/` — Pydantic v2 request/response schemas mirroring models
- `app/api/` — one router file per domain, all mounted at `/api/*`
- `app/agents/` — LangGraph AI agent (`graph.py` + `analyst.py` + `tools.py` + `state.py`); handles natural-language financial queries via SQL tools and DuckDuckGo search; accessed through `app/api/ai.py`
- `app/services/` — `jar_service.py` for jar balance logic
- `app/middleware/` — SecurityHeadersMiddleware, LoggingMiddleware

**Auth flow**: All protected routes use `Depends(get_current_user)` from `app/core/deps.py`, which validates the Bearer JWT and returns the User ORM object.

**AI provider selection**: Controlled by `AI_PROVIDER` env var (`openai`, `google`, `anthropic`, `groq`). Model config lives in `app/core/llm.py` (not config.py).

### Frontend (`frontend/src/`)

- `app/layout.tsx` → wraps with providers (auth, theme, query, next-intl)
- `app/(dashboard)/` — protected pages: dashboard, expenses, incomes, categories, goals, jars, budgets, recurring-expenses, reports, settings
- `app/[locale]/` — i18n entry point (next-intl, locales: `en`/`vi`, default: `vi`)
- `app/login/`, `app/register/` — public auth pages
- `lib/api.ts` — Axios instance (baseURL: `NEXT_PUBLIC_API_URL/api`), attaches Bearer token from localStorage, redirects to `/login` on 401
- `lib/stores/auth-store.ts` — Zustand store for auth state (user, token, isAuthenticated)
- `components/ui/` — shadcn/ui primitives
- `components/providers/` — AuthProvider (redirects unauthenticated), ThemeProvider, QueryProvider
- `i18n/routing.ts` — next-intl routing config

**State**: Auth in Zustand (`auth-store`). Server state via React Query (through QueryProvider). Token persisted in `localStorage`.

## Key Patterns

**Adding a new model**: Create `app/models/<name>.py` → add to `app/models/__init__.py` → import in `alembic/env.py` → run `alembic revision --autogenerate`.

**Adding a new API route**: Create `app/api/<name>.py` → export router in `app/api/__init__.py` → include in `main.py` → add API calls in `frontend/src/lib/api.ts`.

**i18n**: All user-facing strings go in `messages/en.json` and `messages/vi.json`. Use `useTranslations()` hook in components.

**All API routes are user-scoped**: Filter queries by `current_user.id` — never return cross-user data.

## Optional Infrastructure

| Feature | Env Vars | Behaviour when unset |
|---------|----------|----------------------|
| Redis caching | `REDIS_URL` | Disabled silently |
| Email reminders | `SMTP_HOST` | Disabled silently |
| ELK logging | `ELASTICSEARCH_URL`, `ELK_ENABLED=true` | File/stdout only |
| Sentry | `SENTRY_DSN` | Disabled silently |
| Exchange rates | `EXCHANGE_RATE_API_KEY` | Feature unavailable |
