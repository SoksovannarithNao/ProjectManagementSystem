# Task & Project Management System

A full-stack task and project management app — projects, tasks, Kanban board, calendar, team collaboration, and reports/KPI dashboards.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite, React Router, Recharts |
| Backend | Java 21 + Spring Boot 4.0.8 (REST API) |
| Database | PostgreSQL 18.3 |
| Monitoring | Prometheus + Grafana |
| Platform | GitHub Actions (CI/CD) + Docker |
| Build tools | Maven (backend), npm (frontend) |

## Project Structure

```
frontend/     React + Vite UI
backend/      Spring Boot REST API
database/     Schema, ERD, init scripts
api/          API design/contract docs
.github/      CI/CD workflows and review agents
```

Each area has its own README with setup details: [frontend](frontend/README.md) · [backend](backend/README.md).

## Getting Started

### Full stack via Docker
```bash
cp .env.example .env   # first time only
docker compose up -d --build
```

This builds and runs all three services — Postgres, backend, and frontend — wired together:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api |
| Postgres | localhost:5432 |

The frontend's nginx container proxies `/api/*` to the backend, so the app and API are reachable from the same origin. See [database/README.md](database/README.md) for schema/reset details.

### Frontend (local dev)
```bash
cd frontend
npm install
npm run dev
```

### Backend (local dev)
```bash
cd backend
./mvnw spring-boot:run
```

### Database
PostgreSQL 18.3 is expected locally (see [database/init/01-init.sql](database/init/01-init.sql) for init scripts), or use the Docker Compose stack above, which provisions it automatically.

## Team & Workflow

The team is organized into four areas — **Frontend**, **Backend**, **API**, **Database** — described in [Role_Requirment.md](Role_Requirment.md).

Branching model, naming conventions, and the day-to-day PR workflow are documented in [Contributing.md](Contributing.md):

- `main` — protected, always demo-ready
- `dev` — integration branch, all feature branches merge here first
- Feature branches: `<area>/<short-task-description>`, e.g. `frontend/kanban-board`

## CI/CD

GitHub Actions runs on every PR into `dev`/`main` ([ci.yml](.github/workflows/ci.yml)): frontend lint/build, backend Maven verify against a throwaway Postgres instance (schema loaded from [database/init](database/init) before tests run), and a Docker build check for both images. On merge, [cd.yml](.github/workflows/cd.yml) builds and pushes frontend/backend images to GitHub Container Registry (`latest` from `main`, `dev` from `dev`). Frontend tests are not wired in yet (no test suite exists).

## Status

Early-stage. Frontend is built out against mock data; backend has a Spring Boot skeleton with a health endpoint; database schema and API contracts are in progress.
