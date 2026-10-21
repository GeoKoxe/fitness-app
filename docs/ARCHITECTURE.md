# Architecture

## Overview

The Fitness App follows a clean layered architecture separating concerns between the frontend SPA and the backend REST API.

```
┌─────────────────────────────────────┐
│          Browser (React SPA)        │
│  Vite · React · TypeScript · Tailwind│
└──────────────────┬──────────────────┘
                   │ HTTP/REST (JSON)
┌──────────────────▼──────────────────┐
│           FastAPI Backend            │
│  ┌─────────────────────────────────┐│
│  │      API Layer (routers)        ││
│  │  app/api/health.py              ││
│  │  app/api/router.py              ││
│  ├─────────────────────────────────┤│
│  │      Service Layer              ││
│  │  app/services/                  ││
│  ├─────────────────────────────────┤│
│  │      Repository Layer           ││
│  │  app/repositories/              ││
│  ├─────────────────────────────────┤│
│  │      Domain Layer               ││
│  │  app/domain/                    ││
│  ├─────────────────────────────────┤│
│  │      Models (SQLAlchemy ORM)    ││
│  │  app/models/base.py             ││
│  └─────────────────────────────────┘│
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│         SQLite / PostgreSQL          │
└─────────────────────────────────────┘
```

## Backend Module Structure

```
backend/
  app/
    __init__.py
    main.py             # FastAPI app factory, CORS, router registration
    core/
      config.py         # pydantic-settings BaseSettings (DATABASE_URL, APP_ENV)
      database.py       # SQLAlchemy engine, SessionLocal, get_db dependency
    api/
      router.py         # Root APIRouter, aggregates all sub-routers
      health.py         # GET /api/health endpoint
    models/
      base.py           # DeclarativeBase, TimestampMixin
    schemas/
      health.py         # Pydantic response schemas
    repositories/       # Database access objects (future)
    services/           # Business logic layer (future)
    domain/             # Pure domain models / value objects (future)
    integrations/       # 3rd-party API clients (future)
  tests/
    conftest.py         # In-memory SQLite DB, AsyncClient fixture
    test_health.py      # Health endpoint tests
  migrations/
    env.py              # Alembic env with model metadata
    versions/           # Migration scripts
```

## Frontend Module Structure

```
frontend/src/
  App.tsx               # Root application component
  main.tsx              # React DOM entry point
  index.css             # Global styles + Tailwind v4 import
  assets/               # Static assets
  tests/
    setup.ts            # jest-dom matchers setup
    app.test.tsx        # App render smoke test
```

## Data Flow

```
User Action
  → React Component
    → React Router (navigation) | API call (fetch/axios)
      → FastAPI endpoint (router)
        → Service layer (business logic)
          → Repository (DB query via SQLAlchemy)
            → SQLite/PostgreSQL
          ← Repository returns domain object
        ← Service returns result
      ← FastAPI serializes via Pydantic schema
    ← React component updates state
  → UI re-renders
```

## Key Design Decisions

- **Pydantic Settings**: All configuration via environment variables with sensible defaults, never hardcoded secrets.
- **Repository pattern**: Database access isolated from business logic, enabling easy testing with in-memory SQLite.
- **Async by default**: FastAPI and httpx configured for async throughout.
- **Tailwind v4**: Uses the new `@tailwindcss/vite` plugin — no `tailwind.config.js` or PostCSS required.
- **Strict TypeScript**: `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `exactOptionalPropertyTypes` all enabled.
