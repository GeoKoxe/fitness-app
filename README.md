# Fitness App

A personal fitness tracking web application built with React (frontend) and FastAPI (backend).

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS v4     |
| Testing   | Vitest, Testing Library                         |
| Backend   | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2     |
| Database  | SQLite (dev), PostgreSQL-ready                  |
| Testing   | Pytest, pytest-asyncio, httpx                   |

## Project Structure

```
fitness-app/
├── frontend/          # Vite + React + TypeScript
├── backend/           # FastAPI application
│   ├── app/           # Application code
│   ├── tests/         # Pytest tests
│   └── migrations/    # Alembic migrations
└── docs/              # Architecture & planning docs
```

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build
npm run test      # Run tests (watch mode)
npm run test -- --run   # Run tests once
```

### Backend

```bash
# Create virtual environment (first time only)
python -m venv backend/.venv

# Install dependencies
backend/.venv/Scripts/pip.exe install -r backend/requirements.txt

# Run dev server
backend/.venv/Scripts/uvicorn.exe app.main:app --reload --app-dir backend

# Run tests
backend/.venv/Scripts/pytest.exe backend/tests/ -v
```

### Database Migrations

```bash
# From the fitness-app root directory
backend/.venv/Scripts/alembic.exe -c backend/alembic.ini upgrade head
```

## API

- `GET /api/health` — Health check endpoint

## Development Notes

- Frontend runs on port `5173`, backend on `8000`
- CORS is configured to allow `http://localhost:5173`
- SQLite is used for local development; configure `DATABASE_URL` env var for other databases

