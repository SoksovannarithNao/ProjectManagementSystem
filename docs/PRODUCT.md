# Product

<!-- impeccable:product-schema 1 -->

> Written from repository evidence ([overview.md](overview.md), [assignment-brief.md](../assignment-brief.md), [project-workflow.md](../project-workflow.md), [Project_requirement_plan.md](../Project_requirement_plan.md), the code) without a user interview. Anything marked **(inferred)** is a hypothesis to confirm, not a decision. Visual direction lives in [DESIGN.md](DESIGN.md), not here.

## Platform

web

## Users

TaskFlow is used by people who run and do project work inside a team. The requirements define four roles, each with different permissions (implemented as system roles Administrator / Project Manager / User plus the project roles Owner / Team Leader / Team Member / Viewer, see [authentication-authorization.md](authentication-authorization.md)):

- **Administrator**: manages users, roles, permissions, projects and reports.
- **Project Manager**: creates and owns projects, builds the team, sets milestones, assigns work, reviews progress and reports.
- **Team Leader**: shares the planning job with the Project Manager (create tasks, assign them, monitor members) at project level.
- **Team Member**: opens the app to see what is assigned to them, update status, comment, and break work into subtasks.

The two working postures are different. Managers and leaders **scan and decide** (what is late, who is overloaded, is the project on schedule). Members **find and update** (what is mine, what is due, move it forward). Both come back to the app repeatedly during the working day.

**(inferred)** The requirements document is written as a team and course project brief (it mentions a final presentation, live demo and "students' development choice"). Whether TaskFlow is meant for a real organisation, a classroom demo, or both is **undecided**. The audience's industry, size, language and locale are **unknown**.

## Product Purpose

Let a team take a project from creation to completion in one place: register, create a project, add members, set milestones, create and assign tasks, update status, watch progress roll up, and produce reports. Success is that the whole workflow runs end to end (Login → Create Project → Add Team Members → Create Milestones → Create Tasks → Assign Tasks → Update Task Status → Track Progress → Complete Project → Generate Report) and that each person sees only the projects and tasks they are allowed to see.

## Positioning

A single, role-aware workspace covering the whole project loop (people, milestones, tasks, dependencies, comments, activity, notifications, reports) rather than one narrow tool. Task dependencies are enforced, not decorative: a task cannot be started or completed out of order. Visibility is scoped per project, so a user only ever sees work they belong to.

No claim of being faster, smarter or cheaper than other tools has been established. Do not add one.

## Operating Context

- Used at a desk and on tablets and phones; the requirements ask for mobile, tablet and desktop support.
- Work is organised as Project → Milestone → Task → Subtask, with dependencies between tasks.
- Task workflow: To Do → In Progress → In Review → Completed (Cancelled also exists). Task priority: Low, Medium, High, Urgent. Project status: Planning, In Progress, On Hold, Completed, Cancelled. Project priority: Low, Medium, High, Critical.
- **Overdue** (due date passed, not completed) is the most time-sensitive state in the product.
- Registration is by emailed 6-digit code; projects get an automatic `PRJ-####` code; invitations are accepted or declined from notifications.
- Local email is caught by Mailpit; nothing leaves the machine in development.
- Frontend: React 19, React Router 7, Vite, Tailwind CSS 4, Recharts, lucide-react. Backend: Spring Boot, PostgreSQL. Docker Compose deployment.

## Capabilities and Constraints

**Implemented:** self-registration with OTP, login (rate-limited), profile and theme (light, dark, system), projects and membership with invitations, milestones, tasks, subtasks, dependencies, assignment, comments, per-task activity, notifications (6 of 11 types), dashboard, task list with a My Tasks filter, Kanban, calendar (month/week/day), reports (charts), team page, and time tracking (estimated vs. logged hours, work-log entries and a start/stop timer on each task).

**In the requirements, not built** (see [roadmap.md](roadmap.md)): deadline reminders and overdue notifications, Gantt chart, named reports with PDF/Excel export, KPI calculation.

**Constraints that future work must respect:**

- Authorization is enforced per project on the server; the UI must never imply access the user does not have (hide or disable by permission, do not show and fail).
- Terminology is fixed by the domain: *Project, Milestone, Task, Subtask, Assignee, Priority, Status, Overdue, Dependency, Blocked*. Use these words, not synonyms.
- Destructive and unsaved-change actions already have confirmation; keep that.
- The app name shown in the UI and in the OTP email is **TaskFlow**.

## Brand Commitments

- Name: **TaskFlow**.
- A four-square logo mark (two charcoal squares, two lavender squares) exists in the sidebar and auth pages.
- No written voice guidelines exist. Current copy is plain, short and direct ("Nothing due soon.", "Try again"). Keep that register.
- No other brand commitments have been made. Colours, type and shape are recorded as they currently are in [DESIGN.md](DESIGN.md), not as binding brand decisions.

## Evidence on Hand

- Real requirements and workflow definitions: [assignment-brief.md](../assignment-brief.md) (Part B is the resolved specification), [project-workflow.md](../project-workflow.md), [Project_requirement_plan.md](../Project_requirement_plan.md).
- Working application with demo seed data (`database/init/02-seed.sql`).
- Project documentation in this folder.
- **Absent, so do not fabricate:** customer logos, testimonials, usage numbers, benchmarks, pricing, SLAs, compliance claims, or case studies.

## Product Principles

1. **Overdue and blocked work must be impossible to miss.** Deadline risk is the product's core signal; it outranks decoration in every view.
2. **Show only what the user may act on.** Role and project membership shape what appears; permission is a design input, not an error message.
3. **Make the daily path short.** Finding "my tasks" and moving a task forward should take a couple of actions from any screen.
4. **One status vocabulary everywhere.** A status, priority or deadline looks and reads the same on the dashboard, list, board, calendar and detail panel.
5. **Be honest about incomplete features.** Where a requirement is not built (reminders, export), do not present a control that appears to work.

## Accessibility & Inclusion

No product-specific standard has been stated. **(inferred)** Target WCAG 2.1 AA as the baseline for a work tool used all day: 4.5:1 text contrast, visible keyboard focus on every interactive element, status never conveyed by colour alone, touch targets of at least 44px on mobile, and respect for reduced-motion preferences. The current UI falls short of this in several places; see [DESIGN.md](DESIGN.md#known-drift).

Open question for the owner: is any UI language besides English required? Nothing in the repository says so.
