# Developer Setup

Get the Task & Project Management System running on your machine from scratch — no prior setup assumed.

**What you're setting up:** a React web app (frontend), a Spring Boot REST API (backend), a PostgreSQL database, and a local mail catcher (Mailpit) that stands in for a real email server.

## Choose your path

| | **Path A — Docker (recommended to start)** | **Path B — Local dev (for coding with hot reload)** |
|---|---|---|
| What runs in Docker | Everything | Only the database and Mailpit |
| What runs on your machine | Nothing | The backend (Java) and frontend (Node) |
| Extra installs | Docker | Docker + Java 25 + Node |
| Code changes show up | After rebuilding the image | Immediately (frontend) / on restart (backend) |
| Best for | Seeing the app, running tests, reviewing | Day-to-day development |

Do **Path A first** to confirm everything works, then switch to Path B when you start changing code.

---

## 1. Install the prerequisites

| Tool | Needed for | Version | Check it |
|---|---|---|---|
| **Git** | Getting the code | any recent | `git --version` |
| **Docker Desktop** (includes Docker Compose) | Both paths | recent; Compose v2 | `docker --version` and `docker compose version` |
| **JDK 25** | Path B backend, running backend tests | **25** (the project targets Java 25) | `java -version` |
| **Node.js + npm** | Path B frontend, linting, browser tests | **20 or newer** (CI uses 20) | `node --version` and `npm --version` |

Notes:

- **Windows:** install Docker Desktop with the WSL 2 backend and make sure it is **running** (whale icon in the system tray) before you use any `docker` command. You can use PowerShell or Git Bash; both are shown below where the commands differ.
- **JDK:** any distribution works (Temurin / Oracle / Microsoft). You don't need to install Maven — the repo includes a wrapper (`mvnw`).
- You do **not** need to install PostgreSQL yourself; it runs in Docker.

## 2. Get the code

```bash
git clone <repository-url>
cd "Task and Project Management System"
git checkout dev
```

`dev` is the integration branch. Create your own branch off it for your work — see [Contributing.md](../Contributing.md) for the naming rules (`<area>/<short-task-description>`, e.g. `frontend/kanban-polish`) and the PR process.

## 3. Create your `.env` file

The `.env` file holds ports and passwords for Docker. The defaults work for local development.

| Shell | Command |
|---|---|
| PowerShell | `Copy-Item .env.example .env` |
| Git Bash / macOS / Linux | `cp .env.example .env` |

`.env` is git-ignored — never commit it. Only change values if a port is already taken on your machine (see [Troubleshooting](#7-troubleshooting)).

---

## Path A — Everything in Docker

From the repo root:

```bash
docker compose up -d --build
```

The first run downloads images and Maven/npm dependencies, so it can take several minutes. Later runs are fast.

Check that everything is healthy:

```bash
docker compose ps
```

You want `postgres`, `mailpit` and `backend` to say **healthy**, and `frontend` to say **Up**. A fourth container, `migrate`, is a one-shot job: it applies any pending database migration and then exits (`Exited (0)` is correct; it is not listed by `docker compose ps` unless you add `-a`). The backend starts only after it has succeeded. Check what it did with `docker compose logs migrate`. If the backend is still `starting`, wait 20–30 seconds and run it again.

Then open:

| What | URL |
|---|---|
| **The app** | http://localhost:5173 |
| Backend API | http://localhost:8080/api (health check: http://localhost:8080/api/health) |
| Mailpit — see "sent" emails | http://localhost:8025 |
| PostgreSQL | `localhost:5432` |

Log in with a seeded account from [section 5](#5-test-accounts-and-sample-data), for example `admin.system` / `DevPassword123!`.

**Important — Docker runs a built copy of your code.** The backend and frontend containers are *images*, not dev servers. If you edit source files, nothing changes in the running app until you rebuild:

```bash
docker compose build backend frontend
docker compose up -d backend frontend
```

(Rebuild only the one you changed if you like: `docker compose build frontend`, then `docker compose up -d frontend`.) If you want changes to appear instantly while coding, use Path B.

Stop everything with `docker compose stop` (keeps your data) or `docker compose down` (removes containers, keeps data). To wipe the database too, see [Resetting the database](#resetting-the-database).

---

## Path B — Local development

### B1. Start only the database and Mailpit

```bash
docker compose up -d postgres mailpit
```

If your database volume is older than the latest migration, apply it once (the `migrate` service is not started by `up -d postgres mailpit`):

```bash
docker compose run --rm migrate
```

If you previously ran Path A, stop the app containers first so the ports are free:

```bash
docker compose stop backend frontend
```

### B2. Run the backend

The backend needs **JDK 25**. First check which Java Maven will use:

```bash
cd backend
./mvnw -v          # PowerShell: .\mvnw.cmd -v
```

Look at the "Java version" line. If it isn't 25 or newer, point `JAVA_HOME` at your JDK for this terminal (Maven reads `JAVA_HOME`, **not** the `java` on your PATH, so `java -version` can say 25 while Maven still uses an older one):

| Shell | Command |
|---|---|
| PowerShell | `$env:JAVA_HOME = "C:\Path\To\jdk-25"` |
| Git Bash / macOS / Linux | `export JAVA_HOME="/path/to/jdk-25"` |

Then, so that registration emails reach Mailpit (the default mail host is the Docker name `mailpit`, which only resolves inside Docker), start the backend with:

| Shell | Command |
|---|---|
| PowerShell | `$env:MAIL_HOST = "localhost"; .\mvnw.cmd spring-boot:run` |
| Git Bash / macOS / Linux | `MAIL_HOST=localhost ./mvnw spring-boot:run` |

The backend listens on http://localhost:8080. It connects to the Postgres container on `localhost:5432` using sensible defaults, so no other settings are needed. Wait for the line `Started BackendApplication`.

### B3. Run the frontend

In a second terminal:

```bash
cd frontend
npm install        # first time only (and after package.json changes)
npm run dev
```

Open http://localhost:5173. The dev server forwards every `/api/...` call to the backend on port 8080, so there is no API URL to configure.

Edit a file under `frontend/src` and the browser updates immediately.

---

## Environment variables

Defaults work for local development; every variable has a fallback in `docker-compose.yml` or `application.properties`. Names and defaults below come from `.env.example`, `docker-compose.yml` and `backend/src/main/resources/application.properties`.

### Root `.env` (read by Docker Compose)

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `taskmanager` | Database superuser and database name (used for container initialisation only — the backend does not connect as this user) |
| `POSTGRES_PORT` | `5432` | Host port for PostgreSQL |
| `TASKMANAGER_APP_PASSWORD` | `taskmanager_app_password` | Password of `taskmanager_app`, the least-privilege role the backend uses ([ADR-0011](adr/0011-least-privilege-database-role.md)) |
| `JWT_SECRET` | a long development string | HMAC key for tokens. **Change it for any real deployment**; changing it invalidates every existing token |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:80` | Allowed browser origins |
| `BACKEND_PORT` / `FRONTEND_PORT` | `8080` / `5173` | Host ports |
| `MAIL_HOST` / `MAIL_PORT` | `mailpit` / `1025` | SMTP server for registration codes |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | empty | SMTP credentials (not needed for Mailpit) |
| `MAIL_SMTP_AUTH` / `MAIL_SMTP_STARTTLS` | `false` / `false` | SMTP options |
| `MAIL_FROM` | `no-reply@taskflow.dev` | "From" address |
| `MAILPIT_SMTP_PORT` / `MAILPIT_UI_PORT` | `1025` / `8025` | Mailpit host ports |

### Backend-only settings (`application.properties`, override with environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/taskmanager` | JDBC URL (Compose sets `postgres` as the host) |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | `taskmanager_app` / `taskmanager_app_password` | Database login |
| `JWT_EXPIRATION_MS` | `3600000` (1 hour) | Token lifetime |
| `OTP_EXPIRATION_MINUTES` / `OTP_MAX_ATTEMPTS` / `OTP_RESEND_COOLDOWN_SECONDS` | `10` / `5` / `60` | Registration code rules |
| `SECURITY_LOG_LEVEL` | `INFO` | Spring Security log level (`DEBUG` for JWT troubleshooting) |

The frontend has **no** environment variables: it calls relative `/api/...` paths ([ADR-0010](adr/0010-relative-api-paths-and-proxy.md)).

## Database setup

There is nothing to run by hand. On the **first start with an empty data volume**, PostgreSQL executes `database/init/` in filename order: `01-init.sql` (schema, triggers, views), `02-seed.sql` (demo data), `03-app-role.sh` (creates `taskmanager_app`). A fresh volume therefore already has the latest schema. An **existing** volume does not re-run those scripts, so the one-shot `migrate` service (Flyway, `database/taskmanager/migrations/`, baseline version 8) brings it up to date every time you run `docker compose up -d`: it applied `V9__requirement_roles_and_permissions.sql` (the first role matrix) and `V10__two_level_roles.sql` (system roles `ADMINISTRATOR` / `PROJECT_MANAGER` / `USER`, project roles `OWNER` / `ADMIN` / `MEMBER` / `VIEWER`) to the volumes that predate them, and does nothing when the database is current. A fresh volume also gets `04-flyway-baseline.sql`, which records that it is already at version 10. To change the schema: add a new `V<n>__*.sql` migration **and** mirror the end state in `01-init.sql`, so fresh and existing databases end up identical. Details: [database.md](database.md#8-migrations-vs-the-init-script).

## Build commands

| What | Command |
|---|---|
| Backend jar | `cd backend && ./mvnw clean package` (add `-DskipTests` to skip tests; output `backend/target/*.jar`) |
| Frontend production bundle | `cd frontend && npm run build` (output `frontend/dist`) |
| Preview the production bundle | `cd frontend && npm run preview` |
| Both Docker images | `docker compose build` (or `docker compose build backend frontend`) |
| Everything, then start | `docker compose up -d --build` |

CI runs lint + build for the frontend, `mvn -B verify` (with a throwaway PostgreSQL) for the backend, the database invariant check, and a Docker build of both images ([.github/workflows/ci.yml](../.github/workflows/ci.yml)). Pushes to `dev`/`main` publish images to GitHub Container Registry ([cd.yml](../.github/workflows/cd.yml)); there is no automatic deploy.

## 4. Verify it works

You're set up when all of these are true:

- [ ] http://localhost:5173 shows the TaskFlow login page.
- [ ] You can log in as `admin.system` / `DevPassword123!` and see the dashboard.
- [ ] **Projects** lists projects (the sample data has several).
- [ ] *(Optional)* Register a new account at `/register`, then open Mailpit (http://localhost:8025), copy the 6-digit code from the email, and enter it on the verification page.

## 5. Test accounts and sample data

On the first start, the database is filled with realistic sample data: 24 users, 10 projects, tasks, subtasks, comments and notifications.

**Every seeded account uses the password `DevPassword123!`** (development only).

| Username | Who they are | Good for testing |
|---|---|---|
| `admin.system` | Administrator | Sees everything; manages users, roles and the permission matrix (Administration in the sidebar) |
| `pm.olivia` | `PROJECT_MANAGER`; Owner of several projects | Creating projects, Reports, approving tasks, inviting people with a role |
| `lead.owen` | `USER` at system level; Team Leader (`ADMIN`) on a couple of projects | Plans and approves inside a project, opens Reports for it; cannot create projects or delete a project |
| `dev.chen` | `USER`; Team Member (`MEMBER`) of a couple of projects, has assigned tasks | Member permissions: moves work to *In Review* but cannot complete it, no Reports; the **My Tasks** filter |
| `qa.zoe` | Member of one project, viewer of another | Read-only (viewer) behaviour |
| `newuser` | In no project at all | Inviting someone to a project |
| `contractor.felix` | **Inactive** account | Confirming inactive users can't be invited |
| `exemployee.diego` | **Suspended** account | Same, for suspended users |

Your own projects and any accounts you register live in the same database as the sample data. If you break something or want a clean slate, reset it (below).

### Resetting the database

The sample data and schema are loaded **only when the database volume is first created**. To start from scratch (this **deletes all data** in your local database):

```bash
docker compose down -v
docker compose up -d --build
```

You must also do this after anyone changes `database/init/*.sql`, because those scripts only run against an empty database.

---

## 6. Running the tests

### Backend

```bash
cd backend
./mvnw test        # PowerShell: .\mvnw.cmd test
```

Needs the Postgres container running (`docker compose up -d postgres mailpit`) and JDK 25 (see B2). One test starts the whole application, so it must be able to reach the database.

### Frontend: lint and build

```bash
cd frontend
npm run lint
npm run build
```

### Browser (end-to-end) tests

These drive the real app in a real browser against the real backend — nothing is mocked.

```bash
docker compose up -d --build      # the full stack must be running (Path A)
cd frontend
npx playwright install chromium   # one time: downloads the test browser
npm run test:e2e
```

Good to know:

- The tests run against http://localhost:5173 (override with the `E2E_BASE_URL` environment variable).
- They log in with the seeded accounts, so they expect the **sample data to be intact**. If tests fail strangely after lots of manual changes, [reset the database](#resetting-the-database).
- Because Docker serves a *built* copy of your code, rebuild the containers before running them if you changed frontend or backend code.
- `npm run test:e2e:ui` opens Playwright's interactive runner, which is handy for debugging.

---

## 7. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `docker` commands fail with "cannot connect to the Docker daemon" | Docker Desktop isn't running. Start it and wait until it says it's running. |
| "port is already allocated" / "address already in use" | Something else is using 5173, 8080, 5432, 8025 or 1025. Stop it, or change `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT` in `.env` and run `docker compose up -d` again. Remember the Docker `frontend`/`backend` containers use 5173/8080 too — stop them (`docker compose stop frontend backend`) before using Path B. |
| Maven says `release version 25 not supported` | `JAVA_HOME` points at an older JDK. Set it to JDK 25 or newer for your terminal (see B2). |
| Backend crashes on start with a schema / "missing table or column" error | Your local database was built from an older schema. [Reset it](#resetting-the-database). |
| Backend can't connect to the database | Postgres isn't running (`docker compose ps`), or you changed `POSTGRES_*` / `TASKMANAGER_APP_PASSWORD` in `.env` after the volume was created — reset the database. |
| Login fails for every seeded user | Wrong password (it's `DevPassword123!`), or the database wasn't seeded — reset it. Five wrong tries in 15 minutes triggers a temporary lock-out (HTTP 429); wait, or restart the backend. |
| Registering works but no verification email arrives | Emails never go to a real inbox — open Mailpit at http://localhost:8025. In Path B, make sure you started the backend with `MAIL_HOST=localhost` (see B2). |
| Blank page or data never loads | Open the browser's developer tools (Network tab) to see the failing `/api` call. Check the backend log: `docker compose logs backend`, or the file `backend/logs/log.txt`. In Path B, confirm the backend is running on port 8080. |
| I changed code but the app (Docker) looks the same | Docker serves a built copy — rebuild: `docker compose build backend frontend` then `docker compose up -d backend frontend`. Hard-refresh the browser (Ctrl+Shift+R). |
| `npm install` / `npm ci` errors | Check `node --version` is 20 or newer. Delete `frontend/node_modules` and run `npm install` again. |
| Playwright says the browser isn't installed | Run `npx playwright install chromium` inside `frontend/`. |

### Handy commands

```bash
docker compose ps                         # what's running, and is it healthy
docker compose logs -f backend            # follow backend logs
docker compose logs -f frontend           # follow frontend (nginx) logs
docker exec -it taskmanager-postgres psql -U postgres -d taskmanager   # open a SQL prompt
```

---

## 8. Project map (where to look)

```
.
├── backend/      Spring Boot API  (controller → service → repository → entity; dto/ for request/response shapes)
├── frontend/     React app        (src/pages = screens, src/components = shared pieces, src/api = calls to the backend, e2e/ = browser tests)
├── database/     init/ = schema + sample data + app DB role; taskmanager/ = Flyway migrations (applied by the `migrate` Compose service)
├── api/          openapi.yaml — the REST API contract
├── docs/         You are here
├── docker-compose.yml   The whole stack
└── .env.example         Settings template — copy to .env
```

More detail: [backend.md](backend.md), [frontend.md](frontend.md), [database.md](database.md), and the overview in the root [README.md](../README.md).

## 9. Working on a change

1. `git checkout dev && git pull`, then `git checkout -b <area>/<short-task-description>`.
2. Make your change; run the relevant tests (section 6) and `npm run lint` if you touched the frontend.
3. Push your branch and open a **Pull Request into `dev`** (never directly into `main`). CI runs frontend lint + build, backend tests, database checks and Docker builds. Get one teammate's approval before merging.
4. If your change affects what's built or how the project is run, update the relevant page in [docs/](README.md) (for example [roadmap.md](roadmap.md), [issues.md](issues.md) or this guide) in the same PR.

Full rules: [Contributing.md](../Contributing.md).
