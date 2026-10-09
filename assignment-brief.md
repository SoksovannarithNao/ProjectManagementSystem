# Assignment – Task & Project Management System

> **Translation note:** "must" translates ត្រូវ (required); "can/may" translates អាច (optional or flexible). This distinction is kept throughout because it shows what is mandatory versus optional in the assignment.

> **Document structure (2026-10-08):** *Part A* (this file down to the Required Functions list) is the assignment as received and is unchanged. *Part B — Resolved Specification* at the end resolves its contradictions, defines the open terms and fixes the role and permission model; **where Part B differs from Part A, Part B governs**. The user flows are in [project-workflow.md](project-workflow.md).

## Overview

The Task & Project Management System is designed for developing a software application covering User Management, Role & Permission Management, Project Management, Task Management, Team Collaboration, Milestone Management, Deadline Management, Kanban Board, Calendar, Gantt Chart Prototype, Time Tracking, Workload Management, Notifications, Reporting, and a KPI Dashboard. The application aims to build an understanding of the key workflows in project and task management, and to correctly implement Business Logic, Data Modeling, State Management, Navigation, Validation, Authentication, Authorization, and User Experience.

The application supports operations from User Registration, Login, Authentication, Project Creation, Team Member Assignment, Milestone Creation, Task Creation, Task Assignment, Task Progress Updates, and Task Completion, through Project Progress Tracking to Project Completion and Report Generation. These workflows are arranged in sequence so that Project Managers, Team Leaders, and Team Members can organize work, distribute tasks, track progress, and manage deadlines effectively.

---

## Users & Access

The application must be able to manage user information such as User ID, Full Name, Gender, Date of Birth, Phone Number, Email, Profile Photo, Position, Department, Role, and Account Status. Users can View Profile, Edit Profile, Change Password, and Logout according to the defined functions.

The application must support User Registration and Login using a Username or Email and a Password. Authentication must be used to verify user identity, while Authorization must be used to define what each user is allowed to View, Create, Edit, Delete, Assign, Approve, or Generate Report.

The application must be able to manage roles such as Administrator, Project Manager, Team Leader, and Team Member. Each role can be assigned different permissions to ensure users can only use the functions they are allowed to.

---

## Dashboard

The application must have a dashboard showing summary information such as Total Projects, Active Projects, Completed Projects, Delayed Projects, Total Tasks, Pending Tasks, In Progress Tasks, Completed Tasks, and Overdue Tasks. The dashboard can show Project Progress, Task Statistics, Team Workload, and Recent Activities to help managers see the status of work quickly.

---

## Projects

The application must be able to manage project information such as Project ID, Project Name, Project Code, Description, Start Date, End Date, Project Manager, Priority, Status, Progress, and Created Date. The Project Manager can Create, View, and Edit Projects and manage the project lifecycle from Planning to Completion.

Project Status can be **Planning, In Progress, On Hold, Completed,** or **Cancelled**. The application must support project status updates to reflect the actual state of a project while it is in progress.

Project Priority can be **Low, Medium, High,** or **Critical**, to help the Project Manager decide which projects get the highest priority.

The application must be able to manage project teams: the Project Manager can Add Team Members, Remove Team Members, and set each member's role within the project. A project can have a Project Manager, a Team Leader, and multiple Team Members.

The application must be able to designate the Project Manager or Team Leader responsible for each project. The Project Manager must be able to view the Project Progress, Team Workload, Task Status, and Deadlines of the projects they manage.

The application must have a **Project Detail Screen** showing Project Name, Description, Start Date, End Date, Project Manager, Team Members, Project Status, Priority, Milestones, Tasks, Progress, and Deadline.

The application must be able to show a **Project Timeline** including Project Start Date, Project End Date, Milestone Dates, Task Start Dates, and Task Due Dates, to help the team understand the project schedule.

The application must be able to calculate Project Progress as a percentage, based on completed tasks compared to total tasks. When a task's status changes, Project Progress must update according to the defined business logic.

---

## Tasks

The application must be able to manage task information such as Task ID, Task Title, Description, Project, Assignee, Start Date, Due Date, Priority, Status, Progress, Estimated Time, and Created Date.

The application must allow the Project Manager or Team Leader to create new tasks and assign them to the responsible team member. A task must belong to one project and can have one or more assignees, depending on the application's design.

Task Status can be **To Do, In Progress, In Review, Completed,** or **Cancelled**. The application must support a task workflow such as To Do → In Progress → In Review → Completed so the team can clearly track the stage of work.

Task Priority can be **Low, Medium, High,** or **Urgent**. Priority must be used to help team members decide which work to do first.

The application must be able to set a Start Date and Due Date for each task. The Due Date must be used to track Upcoming Tasks, Tasks Near Deadline, and Overdue Tasks.

The application must implement **Overdue Task Detection**: a task whose Due Date has passed but whose status is not yet Completed is marked as Overdue, either automatically or according to the application's business logic.

The application must have **My Tasks**, showing all tasks assigned to the logged-in user. Users can view their Today, Upcoming, In Progress, Completed, and Overdue tasks.

The application must have **Team Tasks**, letting the Project Manager or Team Leader view all team members' tasks and track who is working on what and how much progress they have made.

The application must support **Subtask Management**, allowing a large task to be broken into smaller subtasks. A subtask can have a Title, Assignee, Due Date, Status, and Completion Status.

The application must support a **Checklist** within tasks so users can create lists of small work items and mark them as Completed or Pending. Checklist progress can be used as part of showing task progress.

---

## Milestones

The application must be able to manage milestones, which are key points in a project such as Requirement Complete, Design Complete, Development Complete, Testing Complete, and Project Launch. A milestone can have a Milestone ID, Title, Description, Due Date, Status, and Progress.

Milestone Status can be **Pending, In Progress,** or **Completed**. The application must show milestone progress to help the Project Manager track each project phase.

---

## Views

The application must have a **Kanban Board** showing tasks in columns such as To Do, In Progress, In Review, and Done. The Kanban board can let users move tasks between columns as a prototype to demonstrate task status changes.

The application must have a **Task List View** showing tasks as a list that can be easily searched, filtered, and sorted.

The application must have a **Calendar View** showing tasks, due dates, and milestones in a daily, weekly, or monthly calendar so users can manage their time well.

The application can have a **Gantt Chart Prototype** showing the project timeline, task duration, start date, end date, and task dependencies. A Gantt chart can help the Project Manager see the schedule and overlapping tasks clearly.

---

## Task Dependencies

The application must support **Task Dependency** to define that one task must be finished before another can start. For example, Database Design must be Completed before Backend Development can start.

The application must implement business rule validation for task dependencies, so that a task that depends on an earlier task cannot be Started or Completed out of order without the correct conditions being met.

---

## Search, Filter & Sorting

The application must support **Search** for projects and tasks. Projects can be searched by Project Name, Project Manager, Status, or Date, while tasks can be searched by Task Name, Assignee, Project, Priority, Status, or Due Date.

The application must support **Filters**, so users can filter projects by Active, Completed, On Hold, Priority, or Project Manager, and filter tasks by Status, Priority, Assignee, Project, and Due Date.

The application must support **Sorting**, to sort tasks by Latest, Due Date, Priority, Progress, or Status so users can view work in the order they want.

---

## Collaboration & Documents

The application must support **Comment Management**, allowing team members to discuss tasks, update progress, ask questions, or provide additional information. A comment can have a User, Message, Date/Time, and Reply.

The application can support **Task Discussion**, where users can comment, reply, and continue discussions within a task to reduce the use of external communication channels.

The application must support **File Attachment**, so users can upload documents, images, requirement files, design files, or supporting documents to a project or task.

The application can have **Document Management** for managing Requirement Documents, Design Documents, Meeting Documents, Testing Documents, and Project Reports. Documents can be linked to the relevant project or task.

---

## Activity & Audit Log

The application must have an **Activity Log** recording important actions such as Project Created, Project Updated, Task Created, Task Assigned, Task Status Changed, Comment Added, File Uploaded, and Task Completed.

The application can have an **Audit Log** recording which user did what, when, and on which project or task. The Audit Log helps demonstrate the concepts of Tracking, Accountability, and Audit Trail.

---

## Notifications

The application must support **Notification Management** for Task Assignment, Task Status Change, Comment, Project Update, Upcoming Deadline, Overdue Task, and Milestone Update.

When a new task is assigned to a user, the application must show a Task Assignment Notification containing, for example, Task Name, Project, Due Date, and Assigned By.

The application must have a **Deadline Reminder** to notify users before a task, milestone, or project reaches its deadline. The reminder can be set to 1 Day Before, 3 Days Before, or as a prototype.

The application must have an **Overdue Notification** when a task has passed its due date but is not yet completed, to help team members and the Project Manager resolve delays quickly.

---

## Time Tracking & Workload

The application can support **Time Tracking** to record the time team members spend on tasks. Users can Start Timer, Stop Timer, or enter a Work Log manually, as a prototype.

The application must be able to manage **Work Logs** containing Work Date, User, Task, Hours Worked, and Work Description. Work logs can be used to calculate a task's Actual Time.

A task can have an **Estimated Time** for the expected number of hours or days, and an **Actual Time** showing the real time spent.

The application must be able to show **Team Workload** by calculating each team member's Assigned Tasks, Active Tasks, Overdue Tasks, Estimated Hours, and Actual Hours.

Workload analysis can be used to show which members have too much or too little work, to help the Project Manager with resource allocation and task assignment.

---

## Statistics, KPIs & Performance

The application must have a **Project Progress Dashboard** showing Completed Tasks, Pending Tasks, In Progress Tasks, Overdue Tasks, Project Completion Percentage, and Team Performance.

The application must be able to calculate **Task Statistics** such as Total Tasks, To Do Tasks, In Progress Tasks, Completed Tasks, and Overdue Tasks.

The application must be able to calculate **Project Statistics** such as Total Projects, Active Projects, Completed Projects, Delayed Projects, and Average Project Completion Rate.

The application must be able to generate **KPIs** such as Project Completion Rate, Task Completion Rate, Overdue Rate, Average Task Completion Time, and On-Time Completion Rate.

The application can show **Team Performance** based on each member's Assigned Tasks, Completed Tasks, In Progress Tasks, Overdue Tasks, Completion Rate, and Average Completion Time.

---

## Reports

The application must be able to generate reports such as Project Report, Task Report, Project Status Report, Task Completion Report, Overdue Task Report, Team Performance Report, and Workload Report.

- **Project Status Report** must show projects by Planning, In Progress, On Hold, Completed, Cancelled, or Delayed.
- **Task Completion Report** must show completed tasks and completion percentage by Project, Team Member, or Date Range.
- **Overdue Task Report** must show Task Name, Project, Assignee, Due Date, Days Overdue, and Current Status.
- **Team Performance Report** must show each team member's Assigned Tasks, Completed Tasks, Pending Tasks, Overdue Tasks, and Completion Rate.

The application can support exporting reports as PDF or Excel, as a prototype, so students understand reporting and data export concepts.

---

## Security & Sessions

The application must consider Authentication, Authorization, Session Management, and Secure Access. Users must only be able to see the projects and tasks they have permission for, while the Administrator can manage Users, Roles, Permissions, Projects, and Reports according to the defined rights.

The application must have **Session Management** to handle login sessions, logout, and an auto-logout prototype to protect user accounts.

---

## Validation

The application must perform **Form Validation** on required fields such as Project Name, Start Date, End Date, Task Title, Project, Assignee, Due Date, Status, and Priority before saving data.

The application must perform **Date Validation** to ensure the Project End Date is not earlier than the Project Start Date and that task due dates are in the correct order.

The application must perform **Business Rule Validation**, such as:
- A task's Due Date should not exceed the Project End Date.
- A task must belong to a project.
- A completed task must have a Completion Date.
- Task dependencies must be fulfilled in order.

---

## Architecture & Logic

The application must have **State Management** to manage data and UI state. For example, when a task is completed, the Task Status, Project Progress, Dashboard Statistics, Team Performance, and Activity Log must all be updated consistently.

The application must define **Data Models**, for example: User, Role, Permission, Project, Project Member, Task, Subtask, Checklist, Milestone, Comment, Attachment, Notification, and Work Log.

The application must implement **CRUD Operations** (Create, Read, Update, Delete) on User, Project, Task, Milestone, Comment, and Attachment, according to user permissions.

**Project Business Logic** must manage Project Status, Project Priority, Team Assignment, Timeline, Project Progress, Deadline, and Project Completion.

**Task Business Logic** must manage Task Assignment, Task Status, Task Priority, Dependency, Due Date, Overdue Detection, Progress, and Completion.

---

## UI & UX

The application must have easy-to-use **Navigation**, such as Login → Dashboard → Projects → Project Detail → Tasks → Task Detail → Update Progress. Users must be able to go back to the previous screen and move between modules clearly.

The application must have a **Responsive UI** that works well on Mobile, Tablet, or Desktop, depending on the platform the student chooses to develop for.

The UI must show a **Loading Indicator** while loading or processing data, and an **Empty State** when there are no projects, tasks, notifications, or reports yet.

The application must have **Error Handling** for Login Failed, Invalid User, Project Not Found, Task Not Found, Invalid Date, Invalid Permission, File Upload Failed, Data Save Failed, and Network Error.

The UI must show Success Messages, Error Messages, Warning Messages, Confirmation Dialogs, and Retry Actions as appropriate.

---

## Testing

The application must undergo **Functional Testing** on key functions such as Login, User Management, Project Creation, Task Creation, Task Assignment, Task Status Update, Project Progress, and Report Generation.

- **Project CRUD Testing** must test Create, View, Edit, and Delete Project to ensure project management works correctly.
- **Task CRUD Testing** must test Create, View, Edit, and Delete Task, and Task Assignment.
- **Task Workflow Testing** must test workflows such as To Do → In Progress → In Review → Completed and check that status updates are correct.
- **Deadline Testing** must test Upcoming Task Detection, Overdue Detection, Deadline Reminders, and Date Validation.
- **Permission Testing** must test that the Administrator, Project Manager, Team Leader, and Team Member can only use their permitted functions.
- **Project Progress Testing** must test that project progress updates correctly when a task is Created, Completed, Reopened, or Deleted.
- **Notification Testing** must test Task Assignment Notifications, Deadline Reminders, Overdue Notifications, Project Update Notifications, and Task Status Notifications.
- **UI & Navigation Testing** must test screens, forms, buttons, menus, search, filters, and navigation between modules.

The application must undergo **End-to-End Testing** of the full workflow: Login → Create Project → Add Team Members → Create Milestones → Create Tasks → Assign Tasks → Update Task Status → Complete Tasks → Update Project Progress → Complete Project → Generate Report.

The application must undergo **Debugging** to find and fix errors related to Project Data, Task Data, Permissions, Validation, Navigation, State Management, and Business Logic.

---

## Documentation, Presentation & Demo

The application must have **Project Documentation** including Problem Statement, Objectives, Scope, Requirements, User Roles, Functional Requirements, Non-Functional Requirements, User Flow, Project Workflow, Task Workflow, UI/UX Design, Data Model, Application Architecture, and Test Cases.

At the end of the assignment, students must give a **Final Presentation** explaining the Problem Statement, Objectives, System Features, User Roles, Project Workflow, Task Workflow, UI/UX, Data Model, Application Architecture, Business Logic, and Testing.

Students must give a **Live Demo** showing the real workflow: Login, Create Project, Add Team Members, Create Milestone, Create Task, Assign Task, Update Task Progress, Complete Task, Track Project Progress, through to Complete Project and Generate Report.

---

## Core Workflow

```
Login → Dashboard → Create Project → Add Team Members → Create Milestones → Create Tasks → Assign Tasks → Update Task Status → Track Progress → Complete Tasks → Complete Project → Generate Reports
```

## Required Functions

1. Login & Authentication
2. User Profile
3. User & Role Management
4. Role & Permission
5. Dashboard
6. Project Management
7. Create/Edit Project
8. Project Team Management
9. Project Status & Priority
10. Project Progress
11. Task Management
12. Create/Edit Task
13. Task Assignment
14. Task Priority
15. Task Status
16. Task Due Date
17. Subtask & Checklist
18. Milestone Management
19. Kanban Board
20. Calendar View
21. My Tasks
22. Team Tasks
23. Search, Filter & Sorting
24. Comment & Discussion
25. File Attachment
26. Notification
27. Deadline Reminder
28. Overdue Task Detection
29. Time Tracking / Work Log
30. Team Workload
31. KPI & Dashboard
32. Reports
33. Activity Log
34. State Management
35. Validation & Error Handling
36. Functional Testing
37. End-to-End Testing
38. Project Documentation
39. Final Presentation
40. Live Demo


---
---

# PART B — RESOLVED SPECIFICATION

**Status:** draft for approval · **Written:** 2026-10-08 · **Documentation only — no code, schema or test was changed to write this part.**

Part A (everything above) is the assignment text as received. Part B resolves its contradictions, defines the terms Part A leaves open, and fixes the authorization model so a developer can implement it without guessing. It is paired with [project-workflow.md](project-workflow.md), which holds the user flows.

**How the two parts relate**

- **Strength of a requirement** (must / can) is decided by Part A and does not change here. Part B only classifies and defines.
- **Where Part B differs from Part A, Part B governs**, and the difference is listed in section B0.
- **Wording convention.** *REQUIRED* = Part A says "must". *OPTIONAL* = Part A says "can" or "prototype". *UNDEFINED* = no source says. *OUT OF SCOPE* = explicitly excluded (nothing is, today).
- **`D-nn`** marks a rule this specification had to choose because a source leaves it open. All are collected in section B13.2. D-01 to D-18 were all approved by the project owner on 2026-10-08.
- **"Current implementation"** notes describe the application as it is on 2026-10-09 (after change-plan batches 1, 2, 3a and 3b). They are information, not requirements.

**Outline of Part B** (the 13 headings the specification must contain)

| # | Section | Where |
|---|---|---|
| 1 | Functional Requirements | Part A, plus B1 (definitions) and B1.4 (feature classification) |
| 2 | Non-Functional Requirements | B2 |
| 3 | User Roles & Permissions | B3 |
| 4 | Data Model | B4 |
| 5 | User Flows | [project-workflow.md](project-workflow.md) |
| 6 | Authentication & Authorization | B6 |
| 7 | API Requirements | B7 |
| 8 | Reporting | B8 |
| 9 | Notifications | B9 |
| 10 | Audit / Activity Logging | B10 |
| 11 | Optional Features | B11 |
| 12 | Acceptance Criteria | B12 |
| 13 | Known Gaps / Decisions | B13 |

---

## B0. Contradictions resolved

| # | Contradiction | Resolution |
|---|---|---|
| C-01 | Final task status is "Completed" (Tasks) but "Done" on Kanban/Dashboard/Workflow | **`COMPLETED`**, shown as "Completed". "Done" is not a status. Workflow wording corrected. |
| C-02 | Workflow §9 gives *projects* the priority "Urgent" | Part A governs: **projects** use Low / Medium / High / **Critical**; **tasks** use Low / Medium / High / **Urgent**. Workflow §9 corrected. The two scales are different on purpose; see B1.7. |
| C-03 | Workflow account status "Active / Inactive / **Blocked**" | `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION`. "Blocked" is the same idea as `SUSPENDED`. |
| C-04 | Export, Kanban moving, Time Tracking are "can" in Part A but steps of mandatory flows in the workflow | They stay **OPTIONAL**. Workflow steps are tagged *(Optional)*; demonstrating them is an "Optional feature demonstration". |
| C-05 | Time Tracking is "can" yet appears in the 40 "Required Functions" | The list names functions; it does not set strength. Strength is in B1.4. Time Tracking is OPTIONAL. |
| C-06 | Part A asks for seven named reports; workflow §32 describes one generic report | The seven reports are authoritative (B8). The workflow now points to them. |
| C-07 | Workflow §23 search/filter/sort is narrower than Part A | Part A's lists are authoritative (B1.9). |
| C-08 | "Project Manager" is both a system role (§3–4 of the workflow) and a project-level role ("role within the project") | Two levels: **system roles** and **project roles**, never one hierarchy (B3). |
| C-09 | "Project Manager creates projects" but the workflow also says "assign a Project Manager" after creation | The creator becomes the project's `OWNER`; there is no separate "project manager member" (B3.6). |
| C-10 | Team Leader / Team Member as roles, yet the only per-project roles are Manager / Leader / Member | Team Leader and Team Member are **business labels** for the project roles `ADMIN` and `MEMBER` (B3.1). |
| C-11 | "Approve" is a permission, but no source says what is approved | Approval is a task-level review decision (B3.8). |
| C-12 | Workflow §10 note "Keep the current one" gives no rule | Replaced by the explicit rule in B1.5. |
| C-13 | §17 merges subtasks and checklists | Separate concepts (B1.6). |
| C-14 | §33 activity log and Part A's audit log describe the same thing | Two logs with different audiences (B10). |
| C-15 | "Active", "Pending", "Delayed", "Overdue" undefined or overlapping | Defined in B1.3. |
| C-16 | Part A "Completed Tasks" vs dashboard "Done" counts; "Pending" vs "To Do" | One vocabulary (B1.2, B1.3). |
| C-17 | Part A: only Project Manager / Team Leader create tasks; current application also lets Team Members | Specification follows Part A: Team Members do **not** create tasks (matrix in B3.4). Application mismatch recorded in B13. |
| C-18 | The Required Functions list omits Registration, Change Password, Session Management, Dependencies, Timeline | Added as supporting workflows A1–A9 in the workflow file and classified in B1.4. |

---

## B1. Definitions

### B1.1 Account status

Account status is **not a role**. It decides whether a person can authenticate at all.

| Status | Meaning | Can sign in? |
|---|---|---|
| `ACTIVE` | normal account | yes |
| `INACTIVE` | disabled by an administrator (left the team) | no |
| `SUSPENDED` | blocked by an administrator (also covers "Blocked") | no; an already-issued session also stops working |
| `PENDING_VERIFICATION` | registered, email code not yet entered | no |

Only `ACTIVE` accounts can be invited to projects or assigned tasks.

### B1.2 Task status

| Value | Shown as | Meaning |
|---|---|---|
| `TODO` | To Do | not started |
| `IN_PROGRESS` | In Progress | active work is being performed |
| `IN_REVIEW` | In Review | work is finished by the doer and awaits review/approval |
| `COMPLETED` | Completed | the work is finished **and approved** (B3.8) |
| `CANCELLED` | Cancelled | intentionally removed from scope |

Normal path: `TODO → IN_PROGRESS → IN_REVIEW → COMPLETED`. `CANCELLED` can be set from any other status by someone with `EDIT`. A task can be reopened (`COMPLETED → IN_PROGRESS`) by someone with `EDIT`. "Done" is **not** a status.
*Current implementation:* stored as `TODO` since migration `V11` (2026-10-09); the label shown is "To Do". The UI uses the labels To Do, In Progress, In Review and Completed everywhere ("Done" and "Review" are gone). See D-15.

### B1.3 Derived states (calculated, never stored)

| Term | Applies to | Definition |
|---|---|---|
| **Overdue** | task | `due_date` has passed **and** status is not `COMPLETED` or `CANCELLED`. Due dates are calendar dates: a task due on the 10th becomes overdue on the 11th. Days overdue = today − due date. |
| **Active** | task | status = `IN_PROGRESS` |
| **Pending** | task | status = `TODO` |
| **In Review** | task | status = `IN_REVIEW` (counted separately; it is neither Pending nor Active) |
| **Active** | project | status = `IN_PROGRESS` (decided, D-06: `PLANNING` is not active) |
| **Delayed** | project | calculated: `end_date` has passed **and** status is not `COMPLETED` or `CANCELLED`. |
| **Delayed** | task | not used; use **Overdue**. |

`DELAYED` is **never** a stored status for a project or a task, so it can never contradict the dates. The Project Status Report lists "Delayed" as a derived group next to the five stored statuses (B8).
*Current implementation (2026-10-09):* Overdue and Delayed are both calculated in `backend/util/Derived` from the dates and statuses and never stored. `ProjectResponse` carries `delayed` and `daysDelayed`; `GET /api/dashboard/stats` counts them for what the caller may see; the dashboard, the project cards and page, and the projects filter show them.

### B1.4 Feature classification

Classification of every feature named in only one source or marked inconsistently. Nothing is implemented or removed on the basis of this table.

| Feature | Class | Source and notes | Current application |
|---|---|---|---|
| Registration (email code) | REQUIRED | Part A *Users & Access*; absent from the workflow's 40 functions (now A1) | done |
| Login by username **or** email | REQUIRED | Part A | username only |
| Change password, logout | REQUIRED | Part A *Users & Access* (now A2) | done |
| Session management + auto-logout prototype | REQUIRED | Part A *Security & Sessions* (now A3) | token expires after one hour, no warning or auto-logout |
| Task dependencies and ordering rules | REQUIRED | Part A *Task Dependencies* (now A4) | done (database rules + UI) |
| Project Timeline | REQUIRED | Part A *Projects*; no workflow (now A5) | done (2026-10-09, `/projects/:id/timeline`) |
| Gantt chart prototype | OPTIONAL | Part A "can"; listed in the Overview and the team-responsibilities file but in no function list | missing |
| Kanban board (view by status) | REQUIRED | Part A | done |
| Kanban moving cards between columns | OPTIONAL | Part A "can … as a prototype" | missing (cards open the panel) |
| Calendar (tasks, due dates, milestones) | REQUIRED | Part A; at least one of day/week/month, all three is the target | month view; tasks only |
| Task List with search/filter/sort | REQUIRED | Part A | partly |
| Subtasks | REQUIRED | Part A | done |
| Checklists | REQUIRED | Part A | done (2026-10-09, `V13`) |
| File attachments | REQUIRED | Part A "must" | done (2026-10-09, `V13`) |
| Document management | OPTIONAL | Part A "can" | missing |
| Comments with replies | REQUIRED | Part A | done (replies in the UI since 2026-10-09) |
| Task discussion (threads) | OPTIONAL | Part A "can" | same as above |
| @mentions | UNDEFINED | in neither source; requested for notifications only | missing |
| Notifications (7 kinds) | REQUIRED | Part A | 3 of 7 produced |
| Deadline reminders, overdue notifications | REQUIRED | Part A | database function exists, nothing runs it |
| Time tracking, work logs | OPTIONAL | Part A "can … as a prototype"; work-log fields are listed as "must" if it is built | done |
| Team workload | REQUIRED | Part A | done (2026-10-09: `/projects/:id/workload`, the dashboard card; the Reports page chart stays) |
| KPIs (five) | REQUIRED | Part A | done (2026-10-09: `GET /api/reports/kpis`, the *KPIs* tab) |
| Team performance | OPTIONAL | Part A "can" (but the Team Performance Report is REQUIRED) | done as the Team Performance Report (2026-10-09) |
| Reports (seven named) | REQUIRED | Part A | done (2026-10-09: `GET /api/reports/*`, one tab each) |
| Report export (PDF/Excel) | OPTIONAL | Part A "can … as a prototype" | missing |
| Activity log | REQUIRED | Part A | per task only |
| Audit log | OPTIONAL | Part A "can" | missing |
| Approvals | REQUIRED | the permission `APPROVE` is required; its workflow is defined by this specification (B3.8) | completion gate only |
| Project Detail screen | REQUIRED | Part A | done |
| Responsive UI, loading/empty/error states | REQUIRED | Part A | done |
| Debugging, final presentation, live demo | REQUIRED | Part A; delivered by the student, not the application | — |
| Native mobile application | UNDEFINED | Part A says "Mobile, Tablet, or Desktop, depending on the platform the student chooses" | web, responsive |

### B1.5 Progress

| Item | Rule |
|---|---|
| Task progress | If the task has subtasks: `completed subtasks ÷ all subtasks`. Otherwise a manual value 0–100. A `COMPLETED` task is 100. Checklist items count with the subtasks (D-07, approved): `(completed subtasks + completed checklist items) ÷ (all subtasks + all items)`, with no subtasks and no items the manual value; a `COMPLETED` task whose subtasks are all done stays 100 even if checklist items are open (only subtasks gate completion). Implemented 2026-10-09 (`V13`). |
| Project progress | `completed tasks ÷ (total tasks − cancelled tasks)`. Cancelled tasks do not count as unfinished work. No effective tasks → 0. A task counts only when `COMPLETED` (no partial credit, no weighting by estimate). |
| Milestone progress | the same formula over the tasks linked to the milestone. |
| Subtasks and project progress | Subtasks affect **their parent task's** progress only. They do not count as tasks in project progress. |
| When it updates | immediately, whenever a task is created, deleted, completed, reopened or cancelled (Part A *Statuses*). |

*Current implementation:* matches, including the cancelled-task exclusion.

### B1.6 Subtask vs checklist item

```text
Task
 ├── Subtasks          real child tasks
 └── Checklist items   lightweight tick-boxes inside the task
```

| | Subtask | Checklist item |
|---|---|---|
| What it is | a child task | one line to tick off |
| Fields | title, assignee, due date, status, completion | text, completed yes/no |
| Can have comments, dependencies, own permissions | yes (as a child of its task) | no |
| Counts toward the parent's progress | yes | yes (D-07) |
| Part A | REQUIRED | REQUIRED |

### B1.7 Priority

| Object | Values (low → high) |
|---|---|
| Project | Low, Medium, High, **Critical** |
| Task | Low, Medium, High, **Urgent** |

Part A uses "Critical" for projects and "Urgent" for tasks; the specification keeps both. Do not replace one with the other. *Current implementation:* matches Part A.

### B1.8 Milestone, dependency

- **Milestone.** A project-level checkpoint (a target or event such as "Design Complete"), not a task with a special name. Statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`. Tasks may be linked to it. **Completing a milestone does not complete its linked tasks, and unfinished linked tasks do not by themselves block completing the milestone** (decided, D-08: the user is warned, nothing is changed). Its progress is calculated (B1.5).
- **Dependency.** `Task A blocks Task B` means B is not ready until A is `COMPLETED`. B may not move to `IN_PROGRESS`, `IN_REVIEW` or `COMPLETED` while A is unfinished; `TODO` and `CANCELLED` are always allowed. A task cannot depend on itself or form a cycle. A dependency is a separate concept from a subtask. No override exists (an override would be a new, explicitly approved feature).

### B1.9 Search, filter, sort

| | Projects | Tasks |
|---|---|---|
| **Search by** | name, project manager (owner), status, date | name, assignee, project, priority, status, due date |
| **Filter by** | Active, Completed, On Hold, Priority, Project Manager | status, priority, assignee, project, due date |
| **Sort by** | name, start date, end date, priority, progress (target) | Latest, Due Date, Priority, Progress, Status |

- Filters can be combined (logical AND); search combines with filters; "Clear" restores the full list.
- **Search and filters never widen access.** Results are computed only from items the user may already see (administrator: all; everyone else: projects where they are an active member and the tasks of those projects). A user must never retrieve a project or task through search that they cannot open directly.
- *Current implementation (2026-10-09):* done in the browser, over lists the server already limited to what the caller may see, so a filter can never reveal an item the user cannot open. **Projects:** filter by status (Planning, Active, On Hold, Completed, Cancelled), priority and project manager; sort by name, start date, end date, priority, progress; search over name, description, code, manager, status and dates. **Tasks:** filter by status, priority, assignee (or unassigned), project, due date (overdue, today, next 7 days, none) and My Tasks; sort by latest, due date, priority, progress, status, title; search over title, description, project, assignee, priority, status and due date. Filters combine with AND; Clear restores the list. **Not done:** the list endpoints take no search/filter/sort parameters yet (B11 criterion 2); see G-16.

---

## B2. Non-functional requirements

Part A has no separate list; these are collected from its sections. No numeric performance targets are given anywhere, so they are `UNDEFINED`.

| Area | Requirement | Source |
|---|---|---|
| Security | authentication on every request except login/registration/health/photos; users see only what they are permitted to; passwords never returned or logged | *Security & Sessions* |
| Sessions | login sessions, logout, auto-logout prototype | *Security & Sessions* |
| Data validation | required fields, date order, business rules, dependencies, completion date on completed tasks | *Validation* |
| Data integrity | derived values (progress, overdue) cannot be set to contradict their source data | this spec (B1.3, B1.5) |
| Usability | navigation Login → Dashboard → Projects → Project Detail → Tasks → Task Detail → Update Progress, back navigation at every step | *UI & UX* |
| Responsiveness | works on the chosen platform (web: mobile, tablet, desktop) | *UI & UX* |
| Feedback | loading indicators, empty states, success/error/warning messages, confirmation dialogs, retry | *UI & UX* |
| Error handling | login failed, invalid user, project/task not found, invalid date, invalid permission, upload failed, save failed, network error — each with a readable message | *UI & UX* |
| Accessibility | UNDEFINED in Part A (the application's own design document sets contrast and keyboard rules) | — |
| Performance, capacity, availability, backup | UNDEFINED | — |
| Maintainability | state management keeps task, project progress, dashboard, team performance and activity log consistent after a change | *Architecture & Logic* |
| Auditability | important actions recorded (B10) | *Activity & Audit Log* |

---

## B3. User roles and permissions

### B3.1 Two levels: system roles and project roles

Authorization uses two independent levels, in the style of object/project-level permission models:

| Level | Roles | Stored on | Answers |
|---|---|---|---|
| **System role** | `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER` | the user account | what the person may do **anywhere in the application** |
| **Project role** | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | the membership of one user in one project | what the person may do **inside that one project** |

A person has exactly one system role and any number of project roles, one per project. There is **no single global hierarchy** of roles.

| Requirement concept | Representation |
|---|---|
| Administrator | system role `ADMINISTRATOR` |
| Project Manager | system role `PROJECT_MANAGER` **and normally** project role `OWNER` on the projects they manage |
| Team Leader | project role `ADMIN` |
| Team Member | project role `MEMBER` |
| Viewer / stakeholder | project role `VIEWER` (not named in Part A; kept for read-only participants) |
| a registered person with no management duty | system role `USER` |

- `PROJECT_MANAGER` and `OWNER` are **different things**. `PROJECT_MANAGER` is a system-level role that grants global project-management capability (creating projects, cross-project reports). `OWNER` is a project-level role that grants ownership and authority in **one specific project**.
- **Team Leader** and **Team Member** are *business-role labels*. The implementation roles are `ADMIN` and `MEMBER`. They are **not** system roles and carry no global authority.
- Example: *Alice* has system role `PROJECT_MANAGER`; she is `OWNER` of Project A, `ADMIN` of Project B and `VIEWER` of Project C. Valid. In Project C she can only read.
- Account status (B1.1) is separate from both levels.

### B3.2 The seven permissions

`VIEW`, `CREATE`, `EDIT`, `DELETE`, `ASSIGN`, `APPROVE`, `GENERATE_REPORTS`.

These are **capabilities**, not roles. A role is a named set of capabilities. The permission catalog and the role-to-permission assignments are **authoritative for global (system-level) capabilities** and are part of the application's authorization model, not just stored data.

### B3.3 How a decision is made

```text
User
 ↓
System role              (ADMINISTRATOR / PROJECT_MANAGER / USER)
 ↓
Permissions              (which of the seven the role holds, B3.4)
 ↓
Project membership and project role   (is the user an ACTIVE member, and as what)
 ↓
Resource/action-specific restrictions (ownership of content, assignment, status of the object)
```

Rules, in order:

1. If the account is not `ACTIVE`, deny.
2. **`ADMINISTRATOR`** is allowed everywhere and bypasses project membership.
3. A **system-level action** (create a project, manage users, edit roles and permissions, create positions/departments) needs the matching system capability.
4. A **project-level action** needs an `ACTIVE` membership of that project, and is allowed by the member's **project role** (B3.4). The system role does **not** widen a project role: a `PROJECT_MANAGER` who is a `VIEWER` of a project can only read it (decided, D-02).
5. Then the restriction rules in B3.7 apply (ownership, assignment, status).
6. A non-member asking for a project's data gets "not found" (404), not "forbidden", so the existence of a project is not revealed. Everything else refused is "forbidden" (403) with a message that says what is missing.
7. Project permissions stay scoped to the project. A project `OWNER` does **not** gain any global permission.

### B3.4 Baseline role → permission matrix

`Limited` is defined in B3.5. The `PROJECT_MANAGER` column states what the system role contributes; inside a project its authority is that of the project role it holds there (normally `OWNER`), per rule 4.

| Permission | ADMINISTRATOR | PROJECT_MANAGER | OWNER | ADMIN | MEMBER | VIEWER |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| VIEW | Yes | Yes | Yes | Yes | Yes | Yes |
| CREATE | Yes | Yes | Yes | Yes | Limited | No |
| EDIT | Yes | Yes | Yes | Yes | Limited | No |
| DELETE | Yes | Yes | Yes | Limited | No | No |
| ASSIGN | Yes | Yes | Yes | Yes | No | No |
| APPROVE | Yes | Yes | Yes | Yes | No | No |
| GENERATE_REPORTS | Yes | Yes | Yes | Yes | No | No |

Distinctions:

- `ADMINISTRATOR` bypasses project-level restrictions as the system administrator.
- `PROJECT_MANAGER` may create projects and generate cross-project reports; project management itself happens through the `OWNER` role on each project.
- `OWNER` has full authority within their project.
- `ADMIN` (Team Leader) has project-management authority, including deleting work items and removing members, but **cannot delete the project, transfer ownership, grant `OWNER` or remove the `OWNER`** (decided, D-01).
- `MEMBER` (Team Member) has limited create/edit related to the work they are assigned to.
- `VIEWER` is read-only.
- `VIEW` is always scoped to the projects the user belongs to (`ADMINISTRATOR`: all).
- For `USER` (system role) the only system-level capability is `VIEW` of their own data; everything else comes from project roles.

### B3.5 What "Limited" means

| Permission | A Team Member (`MEMBER`) may | A Team Member may not |
|---|---|---|
| CREATE | subtasks, checklist items, comments (and replies), work-log entries, attachments — on tasks of their project | tasks, milestones, projects, project members, reports |
| EDIT | status and progress of **tasks assigned to them** (but not set `COMPLETED`, B3.8); subtasks and checklist items of tasks assigned to them; their own comments and work-log entries | any other task field, other people's content, milestones, project data |

**`ADMIN` (Team Leader) is Limited only for `DELETE`:** may delete tasks, subtasks, checklist items, milestones, attachments, comments and work logs and remove members (never the `OWNER`); may **not** delete the project (D-01).

### B3.6 Fine-grained actions (enforcement layer)

The seven permissions are the high-level categories. The finer actions below are what the application checks. Where an older document lists "19 actions" it refers to this layer; the layer is kept and organised under the seven permissions.

*Current implementation:* the 19-action `ProjectAccessGuard` of earlier documents was replaced on 2026-10-08 by a *resource × action* check against the `role_permissions` table. The resources (`PROJECT`, `MILESTONE`, `MEMBER`, `TASK`, `TASK_STATUS`, `SUBTASK`, `COMMENT`, `WORK_LOG`, `REPORT`, `USER`, `ROLE`, `LOOKUP`) are the fine-grained layer described here.

| Permission | Fine-grained actions | Held by (project level unless stated) |
|---|---|---|
| **VIEW** | view project, milestones, tasks, subtasks, checklist items, comments, attachments, members, activity | every role, within membership |
| **CREATE** | **create project** *(system)* | `ADMINISTRATOR`, `PROJECT_MANAGER` |
| | create milestone, create task, add/invite member | `OWNER`, `ADMIN` |
| | create subtask, checklist item, comment, work log, attachment | `OWNER`, `ADMIN`, `MEMBER` |
| | create user, create position/department *(system)* | `ADMINISTRATOR` |
| **EDIT** | edit project, edit milestone, edit any task field, set task status of any task | `OWNER`, `ADMIN` |
| | change status/progress of an **assigned** task; edit subtask/checklist of assigned tasks; edit own comment/work log | `MEMBER` (and `OWNER`, `ADMIN`) |
| | edit user, edit roles and their permissions *(system)* | `ADMINISTRATOR` |
| **DELETE** | delete project | `OWNER` (and `ADMINISTRATOR` everywhere) |
| | delete milestone, task, subtask, checklist item, attachment; remove a member (not the `OWNER`); delete other people's comments and work logs | `OWNER`, `ADMIN` (and `ADMINISTRATOR` everywhere) |
| | delete user *(system)* | `ADMINISTRATOR` |
| **ASSIGN** | assign / unassign a task, manage dependencies, designate the approver, set a member's project role (below `OWNER`) | `OWNER`, `ADMIN` |
| | grant `OWNER`, transfer ownership | `OWNER` only (target per D-04) |
| | give a user a **system role** *(system)* | `ADMINISTRATOR` |
| **APPROVE** | decide a task's approval (B3.8) | `ADMINISTRATOR`, `OWNER`, `ADMIN`; `PROJECT_MANAGER` through its project role |
| **GENERATE_REPORTS** | generate the seven reports for a project the user owns or leads | `OWNER`, `ADMIN` |
| | generate reports across projects | `PROJECT_MANAGER` (over the projects they are a member of), `ADMINISTRATOR` (all) |

### B3.7 Restrictions that depend on who did it

These are not roles; they apply on top of the matrix.

| Rule |
|---|
| A comment can be edited **only by its author** (nobody else, not even an administrator). |
| The **author** may delete their own comment, work-log entry, checklist item or attachment even without `DELETE`. |
| A `MEMBER` may change status/progress only of tasks **assigned to them**. |
| An invitation can be accepted or declined only by the invited user. |
| `ASSIGN` for a task requires the assignee to be an `ACTIVE` member of that project. |
| A project must always have exactly one `OWNER` (B3.9). The last `ADMINISTRATOR` cannot be demoted. |
| A user cannot change their own project role, own system role or own account status (profile fields, including position and department, are their own to edit). |

### B3.8 Approval (what `APPROVE` means)

Approval is a **task-level review workflow**. `IN_REVIEW` is a status; approval is a separate state on the task.

```text
Task (IN_PROGRESS)
 ↓  the doer submits for review
IN_REVIEW  +  approval = REQUESTED
 ↓
Approver
 ├── APPROVED           → the task may be set to COMPLETED
 ├── CHANGES_REQUESTED  → the task returns to IN_PROGRESS with a comment
 └── REJECTED           → the approver decides what happens next (reopen as IN_PROGRESS, or CANCELLED) — D-05
```

- `IN_REVIEW` is **not** the same as approved.
- **Who may approve:** `ADMINISTRATOR`, `PROJECT_MANAGER` (through its project role), `OWNER`, `ADMIN`. `MEMBER` and `VIEWER` may not.
- A task may name a **specific approver**; the `OWNER` or an `ADMIN` can designate one (`ASSIGN`). With none designated, any person who may approve can decide.
- A task can become `COMPLETED` only after `APPROVED`. An approver who completes a task directly counts as approving it (recorded with their name). A `MEMBER` can never set `COMPLETED`.
- Every request and decision produces an activity entry and a notification (B9).
- The approval record keeps: task, requested by, requested at, decided by, decision, decided at, comment.
- *Current implementation (2026-10-09, `V12`):* built as specified. `task_approvals` keeps one row per request (PENDING, then APPROVED / CHANGES_REQUESTED / REJECTED, or WITHDRAWN when the task leaves review with no decision); `tasks.approver_id` names an optional approver (set with `ASSIGN`). **Approving completes the task** (progress 100; refused while a subtask is open). Changes requested and Rejected need a comment; Rejected also needs the approver's choice of In Progress or Cancelled. When an approver is named, only that person, the project `OWNER` or an `ADMINISTRATOR` may decide. Nobody decides their own work (requested the review, or is assigned to the task) except the `OWNER` and `ADMINISTRATOR`. An approver who completes a task through the ordinary task edit counts as approving it, under the same rules. Every request and decision writes an activity entry and a notification (requester for a decision; the named approver, otherwise every active member who may approve, for a request; the actor is never notified).

### B3.9 Project creation, ownership and membership

| Question | Answer |
|---|---|
| Who can create a project? | `ADMINISTRATOR` — yes; `PROJECT_MANAGER` — yes; `USER` — no. Decided by the project-creation capability (`CREATE` at system level), **not** by a role-name check. |
| Who owns it afterwards? | The creator becomes the project's `OWNER`. There is no separate "project manager member". |
| Can an administrator create a project for someone else? | Yes (decided, D-03): the administrator names the owner, who must hold the project-creation capability; if no owner is named the administrator is the owner. |
| Can ownership change? | Yes, by the current `OWNER` (or an `ADMINISTRATOR`). The new owner must be able to own projects, i.e. hold `PROJECT_MANAGER` or `ADMINISTRATOR` (decided, D-04). The previous owner becomes `ADMIN` unless removed. Transfer is a single step so there is never zero or two owners. |
| How many of each project role? | **One** `OWNER`; any number of `ADMIN`, `MEMBER`, `VIEWER`. |
| Are project roles independent per project? | Yes. |
| Who sets a member's project role? | `OWNER` (any role except it may not leave the project ownerless); `ADMIN` (only `MEMBER` / `VIEWER`). |
| Which user may be added? | Only `ACTIVE` accounts. |

---

---

## B4. Data model

Conceptual model required by Part A *Architecture & Logic*. "Current" says whether the application already has it.

| Entity | Key fields | Relationships | Current |
|---|---|---|---|
| **User** | id, full name, gender, date of birth, phone, email, username, profile photo, position, department, **system role**, **account status** | belongs to one system role; has many memberships | yes |
| **Role** | name, description, level (system / project), built-in flag; custom system roles are allowed (D-14) | has many permission grants | yes (see B13 for the role set) |
| **Permission** | one of the seven codes | granted to roles per resource and level | yes |
| **Project** | id, code, name, description, start date, end date, **owner**, priority (Low/Medium/High/Critical), status, progress, created date | has members, milestones, tasks | yes (the "project manager" is the owner) |
| **Project member** | project, user, **project role** (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`), membership status (`PENDING`/`ACTIVE`/`DECLINED`), invited by, joined at | exactly one `OWNER` per project | yes |
| **Milestone** | id, title, description, due date, status, progress | belongs to a project; has linked tasks | yes |
| **Task** | id, title, description, project, milestone, start date, due date, priority (Low/Medium/High/Urgent), status, progress, estimated time, created date, completion date, **approval state**, **designated approver** | belongs to one project; has assignees, subtasks, checklist items, dependencies, comments, attachments, work logs | yes except the bold fields |
| **Task assignee** | task, user | assignee must be an `ACTIVE` project member | yes |
| **Task dependency** | task, blocks-task | no self reference, no cycles | yes |
| **Subtask** | title, assignee, due date, status, completion | child of a task | yes |
| **Checklist item** | task, text, completed | child of a task; **not** a task | yes (2026-10-09, `V13`) |
| **Approval record** | task, requested by/at, decided by/at, decision, comment | many per task over time | no |
| **Comment** | task, user, message, date/time, parent comment (reply), mentions *(undefined)* | belongs to a task | yes (replies in the UI since 2026-10-09; no mentions) |
| **Attachment** | project or task, file name, type, size, uploaded by, uploaded at | belongs to a project **or** a task | yes (2026-10-09, `V13`) |
| **Work log** *(optional)* | task, user, work date, hours, description | belongs to a task | yes |
| **Notification** | recipient, type, message, task/project reference, read flag, created at | per user | yes |
| **Activity log entry** | actor, action, project/task, details, time | per project and task | task events only |
| **Audit log entry** *(optional)* | actor, action, target type/id, before, after, time | system-wide | no |
| **Report / KPI / Workload** | calculated from the above; not stored unless exports are kept | — | no |

Integrity rules that live with the data: due date not after the project end date; start date not after due date; a task belongs to a project; a `COMPLETED` task has a completion date; dependencies cannot be circular; an assignee must be an active member; a project always has exactly one owner.

---

## B5. User flows

The flows are in [project-workflow.md](project-workflow.md): the 40 numbered functions of the *Required Functions* list, plus supporting flows A1-A9 for requirements that list omits (registration, change password and logout, session management, task dependencies, project timeline, task approval, audit log, Gantt, documents). Each flow is tagged REQUIRED or OPTIONAL as in B1.4.

---

## B6. Authentication and authorization

- **Sign-in:** username **or** email, plus password; an inactive, suspended or unverified account cannot sign in (B1.1).
- **Registration:** name, username, email, password (policy: ≥ 8 characters with upper, lower, digit and special), then a one-time code sent by email. The new account has system role `USER` and status `ACTIVE` once verified. It cannot create projects until an administrator gives it `PROJECT_MANAGER`.
- **Change password** requires the current password. **Logout** ends the session.
- **Session:** a signed token with a limited lifetime (value UNDEFINED in Part A; current 1 hour); it stops working immediately if the account stops being `ACTIVE`; an **auto-logout prototype** (inactivity timeout with a warning) is REQUIRED.
- **Authorization:** exactly as B3. Every request is checked on the server; the interface only hides what would be refused. A hidden control is removed, not shown disabled.
- **Role administration:** only an `ADMINISTRATOR` can give a system role or edit the permission assignments of roles. The `ADMINISTRATOR` role itself always holds every permission. The last administrator cannot be removed. An `ADMINISTRATOR` can also **create, edit and delete additional system roles** and choose their permissions from the seven (workflow §4); the three built-in system roles cannot be renamed or deleted, and the four project roles are fixed (D-14).
- **Messages:** a refused action states what is missing ("Only a Project Manager or an Administrator can create a project").

---

## B7. API requirements

Part A names these API groups in the team-responsibilities file; this section sets what each must guarantee. Endpoint paths are an implementation matter and are not specified here.

1. **Every endpoint enforces B3 on the server.** No endpoint relies on the client hiding a control.
2. **List and search endpoints are authorization-aware:** they return only what the caller may see (B1.9) and support the search, filter and sort fields of B1.9 as parameters; filters combine with AND.
3. **Groups required:** authentication/registration/session · users · roles and permissions (read the catalog and assignments, edit assignments, give a system role) · projects (create gated by the project-creation capability, ownership transfer) · project members and invitations · milestones · tasks (including approval: request, decide, designate approver) · assignees · dependencies · subtasks · checklist items · comments · attachments (upload, download, delete with type/size validation) · notifications (list, read, deadline and overdue generation) · activity log (project and task) · calendar data (tasks and milestones by date) · timeline data (project, milestone and task dates) · workload · KPIs · the seven reports · optional: work logs, report export, audit log, Gantt data.
4. **Responses:** `400` invalid data (field-level messages), `401` not signed in, `403` signed in but not permitted (specific message), `404` not found **or not visible**, `409` conflicts (duplicate code, ownership rules), `429` too many attempts.
5. **Derived values** (progress, overdue, delayed, workload, KPIs) are computed on the server so every client shows the same numbers.
6. Pagination and rate limits: UNDEFINED.

---

## B8. Reporting

The **seven named reports** are the authoritative requirement. A generic "generate report" does not satisfy it.

**Who may generate:** `GENERATE_REPORTS` (B3.4): `ADMINISTRATOR` (all projects); `PROJECT_MANAGER` (all projects they belong to); `OWNER` and `ADMIN` (their own project). `MEMBER`, `VIEWER` and `USER` may not (they have *My Tasks*). Reports contain only projects and tasks the generator may see.

**Common options:** scope = one project or all the generator's projects · date range · filters by project, user, status, priority · result shown on screen · export is **OPTIONAL** for every report (PDF or Excel, prototype).

| # | Report | Must contain | Specific filters / range | Depends on |
|---|---|---|---|---|
| 1 | **Project Report** | one project: details, owner, dates, status, priority, progress, milestones with progress, task counts by status, team, upcoming deadlines | project (required) | project progress (B1.5) |
| 2 | **Task Report** | list of tasks: title, project, assignee, priority, status, progress, start, due, estimated time | project, assignee, status, priority, due-date range | — |
| 3 | **Project Status Report** | projects grouped by Planning, In Progress, On Hold, Completed, Cancelled **and Delayed** (derived, B1.3) | status, owner, date range | Delayed calculation (missing) |
| 4 | **Task Completion Report** | completed tasks and **completion percentage by Project, Team Member or Date Range** | group by project / member; date range required | completion date |
| 5 | **Overdue Task Report** | task name, project, assignee, due date, **days overdue**, current status | project, assignee, priority | overdue definition (B1.3) |
| 6 | **Team Performance Report** | per member: assigned, completed, pending, overdue tasks and completion rate | project, date range | assignees, completion data |
| 7 | **Workload Report** | per member: assigned, active, overdue tasks, estimated hours, actual hours | project | **actual hours need Time Tracking (OPTIONAL)** — without it, actual hours are shown as unavailable |

*Current implementation (2026-10-09, change-plan 3c):* all seven exist as server endpoints (`GET /api/reports/project`, `/tasks`, `/project-status`, `/task-completion`, `/overdue`, `/team-performance`, `/workload`) and as tabs of the Reports page, each with an explicit *Generate* step. The server enforces who may generate: an Administrator reports on every project, anyone else only on the projects where they hold `GENERATE_REPORTS` (Owner, Team Leader, and the Project Manager through the Owner role); everyone else gets `403`, and a project outside that set `404` (stranger) or `403`. Task Completion needs the date range and counts completed ÷ non-cancelled tasks due in it; Team Performance shows To Do (the "pending" of B1.3), In Progress and In Review apart; the Project Status *Delayed* group is calculated and overlaps the others. The page's first tab, *Overview*, keeps the earlier charts, computed in the browser. Export is not built.

**KPIs (REQUIRED, five).** Part A names them without formulas. Definitions **approved (D-12)** and implemented on 2026-10-09 (`GET /api/reports/kpis`; percentages with one decimal; a rate whose denominator is empty is shown as "—", not 0%):

| KPI | Formula |
|---|---|
| Project completion rate | completed projects ÷ (all projects − cancelled) |
| Task completion rate | completed tasks ÷ (all tasks − cancelled) |
| Overdue rate | overdue tasks ÷ (all tasks − completed − cancelled) |
| Average task completion time | average of (completion date − start date) of completed tasks |
| On-time completion rate | tasks completed on or before the due date ÷ completed tasks |

**Workload.** Per member, over non-cancelled tasks assigned to them: assigned = all; active = `IN_PROGRESS`; overdue = B1.3; estimated hours = sum over assigned tasks that are not completed or cancelled; actual hours = sum of work logs. "Too much / too little work" is judged against the team average (D-13).

---

## B9. Notifications

Part A requires seven kinds (task assignment, status change, comment, project update, upcoming deadline, overdue, milestone update). A recipient rule is written only where a source states it; otherwise it is **pending**.

| Event | Recipients | Rule source | Current |
|---|---|---|---|
| Task assigned | the new assignee. Content: task name, project, due date, assigned by | Part A | yes |
| Task status changed | **pending** (D-10) | none | yes (recipients as built) |
| Comment added | "the people involved" — **pending** who (D-10) | workflow §24 | type exists, not produced |
| Mention | **UNDEFINED** — mentions are in neither source | — | no |
| Deadline approaching (3 days and 1 day before; task, milestone, project) | the assignee and the project's `OWNER` | workflow §27 | no |
| Deadline passed / task overdue | the assignee and the project's `OWNER` | Part A, workflow §28 | generator exists, never run |
| Approval requested | the designated approver; otherwise everyone who may approve — **pending** (D-10) | this spec | yes (2026-10-09) |
| Approval completed | the person who requested — **pending** (D-10) | this spec | yes (2026-10-09) |
| Project updated | **pending** (D-10) | Part A names it | no |
| Milestone updated | **pending** (D-10) | Part A names it | no |
| Project member added / removed | the person added or removed (invitation sent, response returned to the inviter) — the added/removed case is **pending** | partly current | invitation and its response only |

Rules: an actor is not notified of their own action unless D-10 says otherwise; a user can switch task notifications off in their settings (current); a notification is created only for people who may see the item.

---

## B10. Activity log and audit log

Two different things.

| | **Activity log** | **Audit log** *(OPTIONAL)* |
|---|---|---|
| Purpose | user-facing history of project and task work | security and administrative accountability |
| Audience | project members | `ADMINISTRATOR` only (ownership events also to the project `OWNER` — D-11) |
| Examples | "Alice assigned Task A to Bob." · "Bob changed Task A to In Progress." · "Alice commented on Task A." | "Administrator changed Bob's system role." · "Administrator changed permissions of ADMIN." · "Owner transferred ownership of Project A." |
| Events | project created/updated, task created/assigned/status changed/completed, comment added, file uploaded, approval requested/decided (REQUIRED by Part A) | system role changed, permission assignments changed, project role changed, ownership transferred, account created/deleted/activated/suspended, project deleted |
| Record | actor, action, project/task, time (+ readable detail) | actor, action, target type and id, time, **before and after values** |
| Editable? | no | no (append-only) |

*Current implementation (2026-10-09, `V13`):* one `activity_logs` table feeds both views: the task panel (per task) and the project page (`GET /api/activity-logs/project/{id}`, newest first). Recorded: project created / updated (naming what changed) / completed, milestone created / completed, task created / assigned / unassigned / status / priority / due date / deleted, subtask events, approval events, comment and reply added, file uploaded. The audit log (optional) does not exist.

---

## B11. Optional features

Remain optional; none is acceptance criteria. If shown in the demo they are labelled **"Optional feature demonstration"**.

- Kanban: moving cards between columns (the board itself is REQUIRED).
- Time tracking and work logs (timer, manual entry, estimated vs actual).
- Report export to PDF or Excel.
- Gantt chart prototype.
- Document management.
- Task discussion threads beyond comments and replies.
- Audit log.
- Team performance view (the Team Performance **Report** is REQUIRED).

---

## B12. Acceptance criteria

**Roles and permissions**
1. A `USER` who tries to create a project is refused with a message naming who can.
2. A `PROJECT_MANAGER` and an `ADMINISTRATOR` can create a project; the creator is its only `OWNER`.
3. A project role applies only to its own project: the same person can be `OWNER` of one project and `VIEWER` of another and gets the matching rights in each.
4. A `PROJECT_MANAGER` who is a `VIEWER` of a project can read it but not change it.
5. A non-member requesting a project, task or search result sees "not found"; an `ADMINISTRATOR` sees everything.
6. A `MEMBER` cannot create tasks, milestones or members, cannot edit others' tasks, and cannot set `COMPLETED`.
7. A `MEMBER` can change the status/progress of a task assigned to them, up to `IN_REVIEW`.
8. An `ADMIN` can plan and assign work and approve, but cannot delete the project, transfer ownership or grant `OWNER`.
9. A `VIEWER` cannot create, edit, delete, assign or comment anywhere.
10. Only an `ADMINISTRATOR` can give a system role or edit role permissions; the change takes effect on the next request.
11. A project always has exactly one `OWNER`; the last `ADMINISTRATOR` cannot be demoted.
12. A control the user may not use is not shown.

**Approval and status**
13. Submitting a task for review sets `IN_REVIEW` and an approval request; an approver can approve, request changes, or reject; only an approved task can become `COMPLETED`; all of it is logged and notified.
14. Task statuses are exactly To Do, In Progress, In Review, Completed, Cancelled; "Done" appears nowhere.
15. A task is overdue exactly when its due date has passed and it is neither Completed nor Cancelled.

**Progress and rules**
16. Project progress = completed ÷ (total − cancelled) and updates on create, complete, reopen, cancel and delete.
17. A dependent task cannot start, be reviewed or be completed before its prerequisite is completed.
18. A task due date after the project end date, an end date before the start date, or a completed task without a completion date is rejected.

**Search, reports, notifications**
19. Search, filter and sort cover every field in B1.9, combine, and never return an item the user cannot open.
20. Each of the seven reports can be generated by an `OWNER`, `ADMIN`, `PROJECT_MANAGER` (own projects) and `ADMINISTRATOR`, and refused to `MEMBER`/`VIEWER`/`USER`; each contains the columns in B8.
21. Assigning a task notifies the assignee with task name, project, due date and assigner; deadlines (3 days, 1 day) and overdue tasks notify as in B9.

**Account and session**
22. A suspended, inactive or unverified account cannot sign in, and a suspended account's open session stops working.
23. Sign-in works with username or email; the session ends on logout and, as a prototype, after inactivity.

**Documentation and demo**
24. The documentation contains the items in Part A *Documentation*, including non-functional requirements, user flows, task workflow and test cases.
25. The live demo follows the core workflow; any step using an optional feature is labelled as such.

---

## B13. Known gaps and decisions

### B13.1 Differences between this specification and the application

Status after the role-model migration `V10` (2026-10-08) and change-plan batches 1, 2, 3a and 3b (2026-10-09). These are implementation gaps, not reasons to change the requirements.

| # | Area | Status | Detail |
|---|---|---|---|
| G-01 | System roles | **Resolved** | `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`; `TEAM_LEADER` / `TEAM_MEMBER` retired; new accounts are `USER` |
| G-02 | Project roles | **Resolved** | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`; exactly one `OWNER` (deferred trigger + `ProjectOwnership`) |
| G-03 | Permission tables | Resolved earlier | `permissions` / `role_permissions` are used (163 grants, resource × action, editable by an administrator) |
| G-04 | Matrix | **Resolved** | `V10` matrix = B3.4–B3.6; reports through the project roles |
| G-05 | Team Members create tasks | **Resolved** | refused (`403`) |
| G-06 | New roles | Open | cannot be created from the UI; the API can add a bare role with no grants (D-14) |
| G-07 | Own position / department | **Resolved** | the Profile page offers the managed lists; `PUT /api/users/me` accepts `positionId` / `departmentId` (2026-10-09) |
| G-08 | `APPROVE` | **Resolved** | approval records, designated approver, Approved / Changes requested / Rejected, notifications and activity entries (B3.8; 2026-10-09, `V12`) |
| G-09 | `GENERATE_REPORTS` | **Resolved** | the seven report endpoints and the KPIs check it (and which projects it covers) on the server (B8; 2026-10-09, change-plan 3c) |
| G-10 | Authorization code | Informational | `ProjectAccessGuard` asks a permission service resource × action; B3.6 describes the fine-grained layer |
| G-11 | Status name | **Resolved** | stored `TODO` since `V11` (2026-10-09) |
| G-12 | Ownership transfer | **Resolved** | `PUT /api/project-members/{id}` with role `OWNER`, one step; previous owner becomes `ADMIN` |
| G-13 | Administrator creating for others | **Resolved** | the named manager must be able to own projects; becomes the owner |
| G-14 | Missing features | Open | Gantt, audit log, @mentions, auto-logout, deadline reminders, Kanban moving, report export (B1.4) |
| G-19 | Dashboard statistics, Delayed, Team Tasks, Workload, Timeline, role / ownership UI | **Resolved** | built 2026-10-09 (change-plan 3b); see D-13 |
| G-18 | Checklists, attachments, comment replies, project / comment / file activity | **Resolved** | built 2026-10-09 (`V13`, change-plan 3a); see D-07 and D-17 |
| G-15 | A project with a single owner could not be deleted | **Resolved** | the owner check is deferred and skipped for a project being deleted |
| G-16 | Search, filter and sort parameters | Open | project and task filters/sorting work in the browser over permission-scoped lists; the list endpoints take no such parameters (B11 criterion 2) |
| G-17 | Login, labels, assignment notification | **Resolved** | sign-in by username or e-mail; UI says Completed / In Review; the assignment notification names the task, project, due date and assigner (2026-10-09) |

### B13.2 Decisions

**Approved by the project owner on 2026-10-08:** D-01 to D-18. D-01 was changed from the provisional rule (a Team Leader may delete everything except the project, not nothing); D-13 was refined; all others were approved as written. **No decision is open.** Each row shows the rule now in force.

| ID | Question | Rule in force |
|---|---|---|
| D-01 | The matrix says `ADMIN` has no `DELETE`. Does that include deleting tasks, milestones, subtasks and removing members, or only the project? | **Decided:** `ADMIN` may delete tasks, subtasks, checklist items, milestones, attachments, comments and work logs and may remove members (not the `OWNER`); only `OWNER` and `ADMINISTRATOR` may delete the **project**. Category `DELETE` for `ADMIN` is therefore **Limited**. (Matches today's application.) |
| D-02 | Does a system role ever widen a project role? | No. Within a project the project role decides; only `ADMINISTRATOR` bypasses (B3.3 rule 4). |
| D-03 | May an administrator create a project for someone else? | Yes; names the owner (who can own projects); else the administrator owns it. |
| D-04 | Who may receive ownership? What if an owner loses `PROJECT_MANAGER`? | New owner must hold `PROJECT_MANAGER` or `ADMINISTRATOR`. Demoting an owner's system role is refused while they are the sole owner of a project. |
| D-05 | Meaning of `CHANGES_REQUESTED` vs `REJECTED`; is approval needed for every task; may an approver approve their own work? | Changes requested → back to In Progress. Rejected → approver chooses In Progress or Cancelled. Approval needed for every task. Approving one's own work is allowed only for `OWNER`/`ADMINISTRATOR`. **Implemented 2026-10-09.** |
| D-06 | Dashboard definitions: is a `PLANNING` project "active"? Does "Total Tasks" include cancelled? Where is In Review counted? | Active = `IN_PROGRESS` only. Total = all tasks, with Cancelled shown separately. In Review shown as its own count. Buckets are exclusive except Overdue, which overlaps. |
| D-07 | Do checklist items count toward task progress? | Yes: `(completed subtasks + completed checklist items) ÷ (all subtasks + all checklist items)`; manual value if neither exists. **Implemented 2026-10-09.** |
| D-08 | May a milestone be completed with unfinished linked tasks? | Yes, with a warning; tasks are not changed. |
| D-09 | Part A lets a "Project Manager or Team Leader" be the responsible person. Is the responsible person always the `OWNER`? | Yes; a Team Leader (`ADMIN`) assists and may be listed as "lead", but the project record has one responsible person, the `OWNER`. |
| D-10 | Notification recipients for status change, comment, approvals, project/milestone update, member added/removed | Proposal: assignees and the `OWNER`/`ADMIN`s of the project; the actor excluded. |
| D-11 | Who may read the audit log? | `ADMINISTRATOR`; ownership events also visible to that project's `OWNER`. |
| D-12 | KPI formulas | B8 table. **Implemented 2026-10-09** (`ReportService`). |
| D-13 | Overloaded / underloaded thresholds | **Implemented 2026-10-09** (`util/WorkloadClassifier`): a member's load is their open tasks (active + overdue) and the estimated hours of unfinished work; **overloaded** when either is more than 1.5x the team average and at least one task / four hours above it; **underloaded** when open tasks are under half the average (at least one task below) and estimated hours are not above it; **balanced** otherwise and always for a one-person team. An Owner or Team Leader counts only once work is assigned to them. **Decided:** relative to the team. A member is overloaded when their active-plus-overdue tasks or estimated hours are clearly above the average of the same team, underloaded when clearly below; no fixed numbers. The margin is an implementation detail to tune. |
| D-14 | Role creation (workflow §4 "Create or edit a role") | Required. An administrator may create, edit and delete extra **system** roles and assign them any of the seven permissions; the three built-in system roles keep their names and cannot be deleted; project roles stay the four built-ins (custom project roles are UNDEFINED). |
| D-15 | Rename the stored value `TO_DO` to `TODO`? | The specification uses `TODO`; a rename is a separate migration decision. **Done 2026-10-09** (`V11`). |
| D-16 | May users edit their own position and department? | Yes (Part A: users edit their profile; both are profile fields). They choose from the managed lists; only an administrator creates new list entries. An administrator or a project owner/leader may also set them for others (current behaviour). **Implemented 2026-10-09.** |
| D-17 | Attachment limits (types, size) and who may upload/delete | Upload: `OWNER`, `ADMIN`, `MEMBER` on tasks they can see; delete: the uploader, `OWNER` (and `ADMIN`, D-01). **Limits chosen 2026-10-09 (they were UNDEFINED):** 10 MB per file, 25 files per task or project, an allow-list of types (images, PDF, text, CSV, JSON, Office / OpenDocument, ZIP; no executables, scripts, HTML or SVG), content checked against the type. |
| D-18 | Calendar views | at least month; day and week are the target. |

### B13.3 Requirements that still conflict or are still open

| # | Conflict |
|---|---|
| X-1 | ~~`ADMIN` cannot `DELETE` yet has "project-management authority"~~ — **resolved by D-01:** a Team Leader may delete everything except the project. |
| X-2 | Part A: "Project Manager **or** Team Leader responsible" vs one owner per project; resolved only by D-09. |
| X-3 | Part A wording: due date "should not exceed" the project end date (soft) but is listed under *Business Rule Validation*; treated here as a hard rule. |
| X-4 | Part A's Kanban columns say "Done"; the status is "Completed". The column title is "Completed". |
| X-5 | The team-responsibilities file lists Gantt, Calendar, Kanban and KPI **APIs** as duties; Part A makes Gantt optional and does not require dedicated Kanban/Calendar APIs. |
| X-6 | The workflow sets reminders at 3 days and 1 day; Part A says "1 Day Before, 3 Days Before, **or as a prototype**" (either or both). Specification: both. |
| X-7 | The `VIEWER` role is not in Part A's role list; it is retained for read-only participants. |
