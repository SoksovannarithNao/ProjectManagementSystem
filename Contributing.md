## Team & Areas

| Area | Owner focus |
|---|---|
| Frontend | UI, screens, Kanban/Calendar/Gantt views, dashboards |
| Backend | Business logic, auth, validation, business rules |
| API | REST endpoints connecting Frontend ↔ Backend |
| Database | Schema/ERD, tables, relationships |

Areas describe **who usually touches what**, not permanent branches. All code — regardless of area — flows through the same branch model below.

## Branch Structure

Only two branches live permanently:

- **`main`** — protected, always demo-ready. This is what we show for grading, the Live Demo, and the Final Presentation. Nothing is pushed here directly.
- **`dev`** — integration branch. Feature branches merge here first, get tested together, and once stable, `dev` is merged into `main` as a checkpoint.

Everything else is a **short-lived feature branch**, deleted right after it merges.

## Branch Naming

```
<area>/<short-task-description>
```

Use a specific `<area>` (`database`, `backend`, `api`, `frontend`) when a change is isolated to that one layer. Use `project/<short-task-description>` instead once a feature spans layers — most work in practice touches frontend + backend + database together (e.g. adding a page that needs a new endpoint and a schema change), and forcing that under one area's prefix is misleading.

Examples:
```
database/erd-design
database/schema-users-projects
backend/auth-jwt
backend/task-business-logic
backend/overdue-detection
api/task-apis
api/notification-apis
frontend/kanban-board
project/wire_function
project/front_integration
project/docker_compose
```

Tie the branch (and its PR) to the matching GitHub Issue when possible, e.g. `frontend/12-kanban-board`.

## Sequencing Rule

Per the project requirements: **Database Design must be completed before Backend Development starts.**

In practice: get `database/erd-design` and the initial schema branches merged into `dev` *first*. Backend and API work should not start against tables that don't exist yet or are still changing shape. Once the schema is merged and stable, Backend/API/Frontend can proceed in parallel.

## Day-to-Day Workflow

1. Pull the latest `dev`:
   ```
   git checkout dev
   git pull
   ```
2. Create your feature branch off `dev`:
   ```
   git checkout -b <area>/<task-description>
   ```
3. Work, commit, push:
   ```
   git push -u origin <area>/<task-description>
   ```
4. Open a Pull Request **into `dev`** (not `main`). Link the related GitHub Issue.
5. Get at least one teammate to review and approve before merging.
6. Delete the branch after merging (GitHub offers a button right after merge — use it).

## Promoting `dev` → `main`

Do this deliberately, not automatically — after a batch of features has been merged into `dev` and tested together:

1. Confirm `dev` builds and the core workflow (Login → Create Project → Tasks → Complete → Report) still works.
2. Open a PR from `dev` into `main`.
3. Get team sign-off, then merge.

Treat every `dev → main` merge as a checkpoint — a good moment to tag a version if useful (e.g. `v0.1-milestone1-auth`).

## Branch Protection Settings (set these in GitHub → Settings → Branches)

For both `main` and `dev`:
- Require a pull request before merging
- Require at least 1 approval
- (Optional, if you set up CI) Require status checks to pass before merging

## Quick Reference

| Situation | What to do |
|---|---|
| Starting a new task | Branch off `dev` using `<area>/<task>` naming |
| Finished a task | PR into `dev`, get 1 review, merge, delete branch |
| Ready to demo/submit a stable state | PR `dev` into `main` |
| Found unmerged work on an old branch | Open a PR into `dev` before deleting that branch |