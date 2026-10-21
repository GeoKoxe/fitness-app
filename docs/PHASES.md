# Development Phases

## Phase 0 — Project Foundation ✅
**Goal**: Set up the full project scaffolding with no application features yet.

- Vite + React + TypeScript + Tailwind CSS v4 frontend
- FastAPI + SQLAlchemy + Alembic + Pytest backend
- ESLint + Vitest test setup
- Root-level `.gitignore`, `README.md`, `docs/`
- All tests passing, build verified

---

## Phase 1 — Authentication
**Goal**: User sign-up, login, and session management.

- User model with hashed passwords (bcrypt)
- JWT-based authentication (access + refresh tokens)
- FastAPI auth endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`
- Frontend: Login/Register pages, protected routes, auth context
- Alembic migration: `users` table

---

## Phase 2 — User Profile & Settings
**Goal**: Users can set and update their profile and fitness goals.

- Profile model (height, weight, date of birth, gender, activity level)
- Goals model (target weight, weekly workout frequency, calorie target)
- Frontend: Profile settings page, onboarding flow
- Alembic migration: `profiles`, `goals` tables

---

## Phase 3 — Workout Logging
**Goal**: Users can log workouts and exercises.

- Exercise library (predefined + custom exercises)
- Workout session model with sets, reps, weight
- Frontend: Workout log page, exercise search, workout history
- Alembic migrations: `exercises`, `workout_sessions`, `workout_sets` tables

---

## Phase 4 — Nutrition Tracking
**Goal**: Users can log daily food intake and track macros.

- Food database integration (e.g., Open Food Facts API)
- Meal log model (breakfast, lunch, dinner, snacks)
- Calorie and macro summaries
- Frontend: Food diary page, macro pie charts (recharts)
- Alembic migrations: `food_items`, `meal_logs` tables

---

## Phase 5 — Progress & Analytics
**Goal**: Visualize fitness progress over time.

- Body metrics tracking (weight, body fat %, measurements)
- Workout volume trends
- Personal records (PRs) tracking
- Frontend: Dashboard with charts (recharts), progress photos upload
- Alembic migrations: `body_metrics`, `personal_records` tables

---

## Phase 6 — Workout Plans
**Goal**: Users can follow structured workout programs.

- Workout plan model (program templates, scheduled days)
- Plan assignment and tracking
- Frontend: Plan browser, active plan view, workout scheduling
- Alembic migrations: `workout_plans`, `plan_days`, `plan_exercises` tables

---

## Phase 7 — Social & Sharing
**Goal**: Basic social features and progress sharing.

- Follow/following system
- Activity feed (workouts completed, PRs)
- Share workout summaries
- Frontend: Feed page, user profiles (public view)
- Alembic migrations: `follows`, `activity_feed` tables

---

## Phase 8 — Notifications & Reminders
**Goal**: Keep users engaged with timely reminders.

- Workout reminder system (scheduled notifications)
- Streak tracking and achievements
- Frontend: Notification center, achievement badges
- Backend: Background task scheduler (APScheduler or Celery)

---

## Phase 9 — Mobile Optimization & PWA
**Goal**: Make the app installable and mobile-friendly.

- Progressive Web App (PWA) manifest + service worker
- Offline support for viewing recent logs
- Mobile-first responsive design pass
- Push notification support

---

## Phase 10 — Production Readiness
**Goal**: Harden the app for real-world deployment.

- Switch to PostgreSQL
- Docker + Docker Compose setup
- CI/CD pipeline (GitHub Actions)
- Environment-based configuration
- Rate limiting, input sanitization audit
- Comprehensive test coverage (>80%)
- API documentation (OpenAPI/Swagger)

