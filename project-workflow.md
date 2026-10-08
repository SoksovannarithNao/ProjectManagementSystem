# Project Workflow

**Task & Project Management System**

The Task & Project Management System is designed for developing a software application covering User Management, Role & Permission Management, Project Management, Task Management, Team Collaboration, Milestone Management, Deadline Management, Kanban Board, Calendar, Gantt Chart Prototype, Time Tracking, Workload Management, Notifications, Reporting, and a KPI Dashboard. The application aims to build an understanding of the key workflows in project and task management, and to correctly implement Business Logic, Data Modeling, State Management, Navigation, Validation, Authentication, Authorization, and User Experience.

The application supports operations from User Registration, Login, Authentication, Project Creation, Team Member Assignment, Milestone Creation, Task Creation, Task Assignment, Task Progress Updates, and Task Completion, through Project Progress Tracking to Project Completion and Report Generation. These workflows are arranged in sequence so that Project Managers, Team Leaders, and Team Members can organize work, distribute tasks, track progress, and manage deadlines effectively.

---

## How to read this document

**This file holds the user flows.** The rules behind them (roles, the permission matrix, definitions, reports, notifications, acceptance criteria and open decisions) are in **Part B of [assignment-brief.md](assignment-brief.md)**. Section references like *(B3.4)* point there. Where this file and Part B differ, Part B governs.

**Strength of each flow** is stated under its heading and follows the brief (Part A says "must" or "can"):

- **REQUIRED** – the brief says the application must do it.
- **OPTIONAL** – the brief says "can" or "prototype". It is **not** an acceptance criterion. If it is shown in a demo, it is labelled **"Optional feature demonstration"**. A step that belongs to an optional feature is marked *(Optional)* inside an otherwise required flow.

**Two levels of role.** A person has one **system role** (`ADMINISTRATOR`, `PROJECT_MANAGER`, `USER`) and, in each project they belong to, one **project role** (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`).

| Business name used in this document | Representation |
|---|---|
| Administrator | system role `ADMINISTRATOR` |
| Project Manager | system role `PROJECT_MANAGER`, and normally project role `OWNER` on the projects they manage |
| Team Leader | project role `ADMIN` |
| Team Member | project role `MEMBER` |
| Viewer / stakeholder | project role `VIEWER` |

`PROJECT_MANAGER` (system) and `OWNER` (project) are different things: the first lets a person create projects and see cross-project reports; the second gives authority inside one project (B3.1).

**Permissions** are the seven capabilities View, Create, Edit, Delete, Assign, Approve and Generate Reports (B3.2). "The user may…" below always means *the permission matrix allows it* (B3.4); a refused action shows a message that says what is missing.

**Statuses.** Task: To Do, In Progress, In Review, Completed, Cancelled ("Done" is not a status). Project: Planning, In Progress, On Hold, Completed, Cancelled. Milestone: Pending, In Progress, Completed. Account: Active, Inactive, Suspended, Pending verification.

---

## 1. Login & Authentication — REQUIRED

Verifies a user's identity before they can access the system. It ensures that only valid users can view projects and tasks, according to their permissions.

```
Login Screen → Enter Username or Email & Password → Validation → Authentication → Check Account Status → Load System Role & Project Roles → Dashboard
```

1. **Login Screen** – The user opens the login page.
2. **Enter Username or Email & Password** – The user enters account credentials.
3. **Validation** – Check that the required fields are filled in.
4. **Authentication** – Verify the username or email and the password.
5. **Check Account Status** – Only an **Active** account may continue. Inactive and Suspended accounts are refused; a Pending-verification account is asked to enter its email code (see A1).
6. **Load Roles & Permissions** – Load the system role, the project roles and the permissions they carry.
7. **Dashboard** – Redirect the user to the dashboard if login succeeds.

Failure shows a clear message (login failed / invalid user); repeated failures are rate limited.

---

## 2. User Profile — REQUIRED

Stores and manages user information: Full Name, Gender, Date of Birth, Phone, Email, **Position, Department**, Profile Photo.

```
Dashboard → User Profile → View Profile → Edit Profile → Update Information → Validation → Save → Profile Updated
```

1. The user opens the dashboard.
2. Select Profile.
3. View current information.
4. Click Edit Profile.
5. Edit the information. The user edits their **own** profile, including Position and Department, choosing from the managed lists (new list entries are created by an Administrator). The user cannot change their own username, system role, project role or account status.
6. The system validates the input.
7. Save.
8. Display the updated profile.

Changing the password and logging out are in A2.

---

## 3. User & Role Management — REQUIRED

Used by the Administrator to manage users and give each account its **system role**.

```
Administrator → User List → Add/Edit User → Enter User Information → Select System Role → Set Account Status → Save → User Ready
```

1. The administrator opens User Management.
2. View the user list.
3. Add or edit a user.
4. Enter the user's information.
5. Assign a **system role**: Administrator, Project Manager or User (a newly registered account is a User).
6. Set the account status (Active, Inactive, Suspended).
7. Save.
8. The user can use the system according to their role.

**Team Leader and Team Member are not chosen here.** They are roles *inside a project* and are assigned in Project Team Management (§8). A person made Project Manager can create projects; everything else they can do depends on their role in each project (B3.1, B3.3).

---

## 4. Role & Permission — REQUIRED

Defines which roles can View, Create, Edit, Delete, Assign, Approve or Generate Reports.

```
Administrator → Role Management → Create/Edit Role → Select Permissions → Assign Role → Save → User Acts → Check Permission → Allow/Deny
```

1. The admin opens Role Management.
2. Create or edit a role. The Administrator role always holds every permission and is not editable; built-in roles cannot be deleted. Extra system roles can be created (D-14).
3. Select the permissions of the role from the seven.
4. Assign the role to a user (§3).
5. Save.
6. From the user's next request the new permissions apply.
7. Before every action the system checks: account Active → system role → project membership and project role → ownership/assignment restrictions (B3.3).
8. Allow, or deny with a message saying what is missing. A user who is not a member of a project is told it was not found.

---

## 5. Dashboard — REQUIRED

A summary page showing the overall status of projects and tasks, limited to what the user may see.

```
Login → Dashboard → Load Project Data → Load Task Data → Calculate Statistics → Load Recent Activities → Generate KPI/Charts → Display Dashboard
```

1. The user logs in.
2. The system loads the user's projects.
3. Load their tasks.
4. Calculate Total, Active, Completed and Delayed projects (Active = In Progress; Delayed = end date passed and not Completed or Cancelled; B1.3).
5. Calculate Total, **To Do (pending)**, In Progress, **In Review**, **Completed** and Overdue tasks (Overdue overlaps the others; it is not a separate bucket).
6. Load recent activities.
7. Generate KPIs and charts; Team Workload and Project Progress are optional extras for managers.
8. Display the dashboard.

---

## 6. Project Management — REQUIRED

The core feature for managing the project lifecycle from planning to completion.

```
Projects → Create Project → Add Project Information → (Creator becomes Owner) → Add Team → Create Milestones/Tasks → Track Progress → Update Status → Complete Project
```

1. Open Projects.
2. Create a project. Only a **Project Manager** or an **Administrator** can; a User cannot (B3.9).
3. Enter Project Name, Code, Description, Dates, Priority, Status.
4. **The creator becomes the project's Owner** — the project's responsible Project Manager. There is no separate "assign a manager" step (an Administrator creating a project for someone else: D-03).
5. Add team members (§8).
6. Create milestones and tasks.
7. Track progress.
8. Update the project status.
9. Complete the project when the work is finished (set status Completed; progress follows the tasks and is not forced).

---

## 7. Create/Edit Project — REQUIRED

Used to create a new project or edit an existing one.

```
Project List → Add/Edit Project → Enter Name/Code → Description → Start/End Date → Owner → Priority → Status → Validation → Save
```

1. Open the project list.
2. Click Add or Edit (Add needs project-creation rights; Edit needs the Edit permission in that project: Owner or Team Leader).
3. Enter the project name and code (a code is generated if left blank).
4. Enter a description.
5. Set the start date and end date.
6. The Owner is shown (the creator; changing the owner is an ownership transfer, only by the current Owner or an Administrator; B3.9).
7. Set the priority: Low, Medium, High, Critical.
8. Set the status.
9. Validate the data: required fields; end date not before start date; unique code.
10. Save the project.

---

## 8. Project Team Management — REQUIRED

Manages the members participating in a project and their project roles.

```
Project Detail → Team Members → Add/Invite Member → Select User → Assign Project Role → Save → View Workload → Remove/Change Role if Needed
```

1. Open Project Detail.
2. Open Team Members.
3. Add or invite a member (only Active accounts; the invited person accepts or declines).
4. Select a user.
5. Assign the project role: **Owner** (the Project Manager), **Team Leader** (`ADMIN`), **Team Member** (`MEMBER`) or **Viewer** (`VIEWER`).
6. Save.
7. View the member's workload.
8. Remove the member or change their role if needed.

Rules: exactly one Owner per project; many Leaders, Members and Viewers. The Owner can set any role below Owner and transfer ownership; a Team Leader can add and set Members and Viewers and remove Members and Viewers, but cannot grant Owner, transfer ownership, remove the Owner or delete the project (D-01). A user's role in one project is independent of every other project (B3.1, B3.9).

---

## 9. Project Status & Priority — REQUIRED

Project Status shows the project's current stage; Priority shows its importance.

```
Project → Select Status → Planning / In Progress / On Hold / Completed / Cancelled → Select Priority → Low / Medium / High / Critical → Save
```

1. Open the project.
2. Select a status.
3. Set the current stage.
4. Select a priority.
5. Set the priority level — **Low, Medium, High or Critical** (project priority is not "Urgent"; Urgent is the task scale, §14).
6. Save.
7. The dashboard and reports update accordingly.

"Delayed" is **not** a status; it is calculated from the dates (B1.3).

---

## 10. Project Progress — REQUIRED

The percentage of work completed, based on the tasks in the project.

```
Load Project Tasks → Count Total Tasks → Remove Cancelled → Count Completed Tasks → Calculate Progress → Update Project → Display Percentage
```

1. Load all tasks.
2. Count total tasks and remove the **Cancelled** ones.
3. Count **Completed** tasks.
4. Calculate the percentage.
5. Update project progress.
6. Display a progress bar or percentage.

**Formula:**

```
Project Progress = Completed Tasks ÷ (Total Tasks − Cancelled Tasks) × 100        (0 when there are no counted tasks)
```

A task counts only when it is Completed. Cancelled tasks are not unfinished work. Subtasks change their **parent task's** progress, not the project's directly (B1.5). Progress updates immediately whenever a task is created, completed, reopened, cancelled or deleted.

---

## 11. Task Management — REQUIRED

Manages the individual units of work within a project.

```
Project → Tasks → Create Task → Assign Member → Set Priority → Set Dates → Update Status → Track Progress → Request Approval → Complete Task
```

1. Select a project.
2. Open Tasks.
3. Create a task (Owner or Team Leader; Administrator anywhere). A Team Member does **not** create tasks; they add subtasks and checklist items.
4. Assign a team member.
5. Set the priority.
6. Set the start and due dates.
7. Update the status while working.
8. Track progress.
9. Submit for review; an approver approves it (A6).
10. The task becomes Completed.

---

## 12. Create/Edit Task — REQUIRED

Used to create a new task or edit an existing one.

```
Task List → Add/Edit Task → Enter Title/Description → Select Project → Assign User → Dates → Priority → Status → Estimated Time → Validate → Save
```

1. Open the task list.
2. Add or edit a task (Edit: Owner or Team Leader; a Team Member only changes status and progress of tasks assigned to them).
3. Enter a title and description.
4. Link it to a project (required).
5. Assign a user (an Active member of that project).
6. Set dates.
7. Set priority: Low, Medium, High, **Urgent**.
8. Set status.
9. Set estimated time.
10. Validate: required fields; start date ≤ due date; due date not after the project end date; a Completed task has a completion date.
11. Save.

---

## 13. Task Assignment — REQUIRED

Distributes work to the responsible team member.

```
Create/Open Task → Select Assignee → Check Project Membership → Check Workload → Assign → Save → Send Notification
```

1. Open a task.
2. Select an assignee.
3. Check that the user is an **Active member of the project** (required).
4. Optionally check their workload (§30).
5. Assign the task (needs the Assign permission: Owner, Team Leader, Administrator).
6. Save.
7. The assignee receives a notification with the task name, project, due date and who assigned it.

A task belongs to one project and may have one or more assignees.

---

## 14. Task Priority — REQUIRED

Defines which work should be done first.

```
Task → Select Priority → Low / Medium / High / Urgent → Save → Sort/Display by Priority
```

1. Open a task.
2. Select a priority.
3. Set Low, Medium, High or **Urgent**.
4. Save.
5. The system can sort tasks by priority.

---

## 15. Task Status — REQUIRED

Shows the current stage of a task.

```
To Do → In Progress → In Review → Completed        (Cancelled: removed from scope)
```

1. **To Do** – The task has not started.
2. **In Progress** – Active work is being performed.
3. **In Review** – The work is finished by the doer and awaits review and approval.
4. **Completed** – The work is finished and approved.
5. **Cancelled** – The task was intentionally removed from scope.
6. A status change also updates project progress, the dashboard and the activity log (§34).
7. **In Review is not "approved".** Approval is a separate decision (A6). A Team Member can take a task up to In Review; only someone who may Approve can complete it.
8. A task cannot start or be completed before the tasks it depends on are Completed, nor be Completed while subtasks are open (A4, §17).

---

## 16. Task Due Date — REQUIRED

The deadline by which a task must be completed.

```
Create Task → Set Start Date → Set Due Date → Validate Dates → Save → Monitor Deadline → Reminder / Overdue
```

1. Create a task.
2. Set the start date.
3. Set the due date.
4. The system validates the dates.
5. Save.
6. Monitor the deadline.
7. Send a reminder before the due date (§27), or mark as Overdue after it (§28).

---

## 17. Subtask & Checklist — REQUIRED (two separate things)

```
Task
 ├── Subtasks          real child tasks
 └── Checklist items   lightweight tick-boxes
```

```
Task Detail → Add Subtask / Add Checklist Item → Enter Details → Save → Mark Completed → Recalculate Progress
```

**Subtask** – a child task with title, assignee, due date, status and completion; it can have comments and dependencies.
**Checklist item** – a single line with a tick; no assignee, no due date, no comments.

1. Open Task Detail.
2. Add a subtask (title, assignee, due date) or a checklist item (text).
3. Save.
4. Mark it Completed when done.
5. The system updates the task's progress (B1.5; how checklist items count is D-07).
6. A task cannot become Completed while a subtask is open.

Team Members may add subtasks and checklist items to the tasks they work on.

---

## 18. Milestone Management — REQUIRED

A milestone is a project-level **checkpoint** (an important event or target such as "Design Complete"), not a task with a special name.

```
Project → Milestones → Add Milestone → Enter Title/Description → Due Date → Status → Link Tasks → Track Progress → Complete
```

1. Open the project.
2. Open Milestones.
3. Add a milestone (Owner or Team Leader).
4. Enter the details.
5. Set the due date.
6. Set the status: Pending, In Progress, Completed.
7. Link tasks.
8. Track progress (Completed linked tasks ÷ non-cancelled linked tasks).
9. Mark as Completed.

**Completing a milestone does not complete its linked tasks**, and linked tasks stay independent (D-08: a warning is shown if some are unfinished).

---

## 19. Kanban Board — REQUIRED (the board) · OPTIONAL (moving cards)

Displays tasks in columns by status so the team sees the workflow at a glance.

```
Open Kanban → Load Tasks → To Do / In Progress / In Review / Completed → View Cards → (Optional) Move Task → Update Status → Save → Refresh Board
```

1. Open the Kanban board.
2. Load the tasks the user may see.
3. Display them in the columns To Do, In Progress, In Review, Completed (Cancelled tasks are not shown as a column).
4. Selecting a card opens the task.
5. *(Optional)* The user moves a card to another column.
6. *(Optional)* The system updates the task status — using the same rules as §15: a Team Member can move a card only as far as In Review, a move to Completed needs the Approve permission, and a move that breaks a dependency is refused.
7. *(Optional)* Save and refresh the board.

Steps 5–7 are the **Optional feature demonstration** "Kanban drag-and-drop".

---

## 20. Calendar View — REQUIRED

Displays tasks, milestones and deadlines by day, week or month.

```
Calendar → Select Daily/Weekly/Monthly → Load Tasks/Milestones → Display by Date → Select Item → View/Edit Detail
```

1. Open the calendar.
2. Select Daily, Weekly or Monthly (at least one is required; all three is the target).
3. The system loads the user's tasks and milestones.
4. Display them by date.
5. Click an item.
6. View its details; edit them if the user has the Edit permission.

---

## 21. My Tasks — REQUIRED

Shows all tasks assigned to the logged-in user.

```
Login → My Tasks → Load Assigned Tasks → Group Today/Upcoming/In Progress/Completed/Overdue → Select Task → Update Progress
```

1. The user logs in.
2. Open My Tasks.
3. The system loads tasks assigned to the user.
4. Group them: Today, Upcoming, In Progress, Completed, Overdue.
5. The user selects a task.
6. Update its status or progress (up to In Review for a Team Member).

---

## 22. Team Tasks — REQUIRED

Lets the Project Manager (Owner) or Team Leader view the work of all members of a project.

```
Project → Team Tasks → Load Members → Load Assigned Tasks → Group by Member → View Status/Progress → Reassign/Follow Up
```

1. Select a project (the user must be its Owner or Team Leader, or an Administrator).
2. Open Team Tasks.
3. Load team members.
4. Load their tasks.
5. Group by member.
6. View status and progress.
7. Reassign (Assign permission) or follow up if needed.

---

## 23. Search, Filter & Sorting — REQUIRED

Organises projects and tasks so users can find information quickly. Everything below is limited to what the user may already see; results never include an item the user cannot open (B1.9).

```
Open List → Enter Search Keyword → Select Filters → Select Sort → Apply → Load Matching Data → Display Results → Clear
```

1. Open the project or task list.
2. **Search** – projects by name, project manager (owner), status or date; tasks by name, assignee, project, priority, status or due date.
3. **Filter** – projects by Active, Completed, On Hold, Priority or Project Manager; tasks by status, priority, assignee, project and due date. Filters can be combined.
4. **Sort** – tasks by Latest, Due Date, Priority, Progress or Status.
5. Apply.
6. The system loads matching data.
7. Display results.
8. Clear filters to view everything.

---

## 24. Comment & Discussion — REQUIRED (comments and replies) · OPTIONAL (extended discussion)

Lets the team discuss and share updates within a task.

```
Task Detail → Discussion → Add Comment → Enter Message → Submit → Notify People Involved → Reply → Continue Discussion
```

1. Open a task.
2. Open Discussion.
3. Add a comment (Owner, Team Leader, Team Member; not a Viewer).
4. Enter a message.
5. Submit.
6. Notify the people involved (recipients: D-10).
7. Other users can **reply**.
8. Keep the discussion history. A comment can be edited only by its author; the author or someone with Delete can remove it.

@mentions are not part of either source document (UNDEFINED).

---

## 25. File Attachment — REQUIRED

Lets users attach documents, images, requirement files or design files to a project or task.

```
Project/Task → Attachments → Choose File → Validate File → Upload → Save Metadata → Display Attachment → Download/View/Delete if Allowed
```

1. Open a project or task.
2. Open Attachments.
3. Choose a file.
4. Validate type and size (limits are not defined yet; D-17).
5. Upload (Owner, Team Leader, Team Member).
6. Save the file information (name, type, size, who, when).
7. Display the attachment; an upload failure shows a clear error.
8. View, download or delete according to permissions (the uploader or the Owner can delete).

---

## 26. Notification — REQUIRED

Informs users about task assignments, status changes, comments, deadlines, project and milestone updates, and approvals.

```
Event Occurs → Check Notification Rule → Select Recipient → Create Notification → Send/Display → User Opens → Mark as Read
```

1. An event occurs.
2. The system checks the notification rule (B9 lists every event).
3. Determine the recipients.
4. Generate the notification.
5. Display the notification.
6. The user opens it.
7. Mark as read.

---

## 27. Deadline Reminder — REQUIRED

Notifies users before a task, milestone or project reaches its due date.

```
Check Upcoming Deadlines → Apply Reminder Rule → 3 Days / 1 Day Before → Generate Reminder → Notify User
```

1. The system checks deadlines (on a schedule).
2. Apply the reminder rule: **3 days and 1 day** before.
3. Find items approaching their due date that are not Completed or Cancelled.
4. Generate a message.
5. Notify the assignee and the project Owner.

---

## 28. Overdue Task Detection — REQUIRED

Finds tasks that have passed their due date and are not finished.

```
Check Tasks → Due Date Passed? → Status Not Completed/Cancelled? → Mark Overdue → Calculate Days Overdue → Notification → Dashboard/Report Update
```

1. The system checks tasks.
2. Compare today with the due date (a task due on the 10th is overdue from the 11th).
3. Check the status.
4. If the due date has passed **and** the status is not Completed or Cancelled → Overdue (calculated, never stored).
5. Calculate days overdue.
6. Notify the assignee and the project Owner.
7. Update the dashboard and reports.

---

## 29. Time Tracking / Work Log — OPTIONAL

Records the time team members spend on tasks. **Everything in this section is an Optional feature demonstration.**

```
Task → Start Timer / Add Work Log → Work on Task → Stop Timer → Calculate Duration → Enter Description → Save → Update Actual Time
```

1. Open a task.
2. Start the timer or add a manual work log.
3. The user works on the task.
4. Stop the timer.
5. The system calculates the duration.
6. Enter a work description.
7. Save the work log (date, user, task, hours, description).
8. Update the task's actual time.

If built, a Team Member logs time for themselves; the author or the Owner can delete an entry.

---

## 30. Team Workload — REQUIRED

Shows how much work each member has, helping the Project Manager distribute work.

```
Load Team Members → Count Assigned Tasks → Count Active/Overdue Tasks → Sum Estimated Hours → Sum Actual Hours (if time tracking exists) → Analyze Workload → Display
```

1. Load team members.
2. Count assigned tasks (not Cancelled).
3. Count active (In Progress) and overdue tasks.
4. Sum estimated hours of the unfinished assigned tasks.
5. Sum actual hours *(Optional: needs Time Tracking, §29; otherwise shown as unavailable)*.
6. Analyze workload.
7. Display members who are overloaded or underloaded (compared with the team average, D-13).

---

## 31. KPI & Dashboard — REQUIRED

Measures the performance of projects, tasks and teams.

```
Collect Project/Task Data → Calculate Completion Rate → Overdue Rate → On-Time Rate → Average Completion Time → Display KPI
```

1. Collect project and task data.
2. Calculate the project completion rate.
3. Calculate the task completion rate.
4. Calculate the overdue rate.
5. Calculate the on-time completion rate.
6. Calculate the average task completion time.
7. *(Optional)* Analyze team performance per member.
8. Display KPIs and charts.

Formulas: B8 (to be approved, D-12).

---

## 32. Reports — REQUIRED (the seven reports) · OPTIONAL (export)

```
Reports → Select One of the Seven Reports → Scope & Date Range → Filters → Load Data → Calculate Summary → Generate Report → View → (Optional) Export PDF/Excel
```

1. Open Reports (needs the Generate Reports permission: Owner or Team Leader of the project, Project Manager over their projects, Administrator).
2. Select one of the **seven named reports**: Project Report, Task Report, Project Status Report, Task Completion Report, Overdue Task Report, Team Performance Report, Workload Report. Their contents, filters and dependencies are specified in B8.
3. Choose the scope (one project or all the user's projects) and the date range.
4. Filter by project, user, status or priority.
5. Load data (only projects and tasks the user may see).
6. Calculate the summary.
7. Generate the report.
8. View.
9. *(Optional)* Export as PDF or Excel — an **Optional feature demonstration**.

---

## 33. Activity Log — REQUIRED

The user-facing history of important actions in projects and tasks. (The administrative **audit log** is a different thing: A7.)

```
User Action → Capture User → Action Type → Project/Task → Date/Time → Save Log → Display Activity History
```

1. A user performs an action.
2. The system records the user.
3. Record the action: project created or updated; task created, assigned, status changed, completed; comment added; file uploaded; approval requested or decided.
4. Record the project/task.
5. Record the date/time.
6. Save the log (entries cannot be edited).
7. Display the activity history to members of the project.

---

## 34. State Management — REQUIRED

Ensures data and UI on every screen stay in sync after a change.

```
User Action → Permission Check → Business Logic → Update Data → Update State → Refresh Task → Project Progress → Dashboard → Team Performance → Activity Log
```

**Example:** Task approved and Completed → task status updates → Completed count increases → project progress updates → milestone progress updates → team performance updates → activity log and notifications are written → dashboard refreshes.

---

## 35. Validation & Error Handling — REQUIRED

Validation protects against invalid data and workflows; error handling shows messages to the user.

```
User Input → Required Validation → Date Validation → Permission Check → Business Rule Check → Valid? → Save / Show Error → Correct → Retry
```

1. The user enters data.
2. Check required fields (project name, dates, task title, project, assignee, due date, status, priority).
3. Check start/end/due dates (end not before start; due not after the project end date).
4. Check permissions.
5. Check business rules: a task belongs to a project; a Completed task has a completion date; dependencies are respected; assignees are active members.
6. If valid → Save.
7. If invalid → show a specific error (invalid date, invalid permission, not found, upload failed, save failed, network error).
8. The user corrects the data.
9. Retry.

---

## 36. Functional Testing — REQUIRED

Checks whether each function works according to its requirement.

```
Requirement → Test Case → Test Data → Execute → Expected Result → Actual Result → Pass/Fail → Fix → Retest
```

1. Select a requirement.
2. Create a test case.
3. Prepare test data.
4. Execute.
5. Define the expected result.
6. Compare with the actual result.
7. Pass or fail.
8. Fix errors.
9. Retest.

Required test areas (brief): Login, User Management, Project CRUD, Task CRUD and assignment, **Task workflow** (To Do → In Progress → In Review → Completed), **Deadline** (upcoming, overdue, reminders, date validation), **Permission** (Administrator, Project Manager, Team Leader, Team Member and Viewer can use only their permitted functions), **Project progress** (create, complete, reopen, delete), **Notification** (assignment, reminder, overdue, project update, status), UI & navigation. Acceptance criteria: B12.

---

## 37. End-to-End Testing — REQUIRED

Tests the full project workflow, from creating a project to completing it and generating a report.

```
Login → Create Project → Add Team Members → Create Milestones → Create Tasks → Assign Tasks → Update Status → Submit/Approve → Complete Tasks → Update Project Progress → Complete Project → Generate Report
```

1. Login (as a Project Manager).
2. Create a project (the Project Manager becomes Owner).
3. Add the team (a Team Leader, Team Members).
4. Create milestones.
5. Create tasks.
6. Assign tasks.
7. Update task status (Team Member: up to In Review).
8. Approve and complete tasks (Owner or Team Leader).
9. Project progress updates.
10. Complete the project.
11. Generate a report.

---

## 38. Project Documentation — REQUIRED

Describes the project from the problem statement through testing.

```
Problem Statement → Objectives → Scope → Requirements → User Roles → Functional Requirements → Non-Functional Requirements → User Flow → Project Workflow → Task Workflow → UI/UX → Data Model → Architecture → Business Logic → Test Cases → Final Documentation
```

1. Write the problem statement.
2. Define objectives.
3. Define scope.
4. Gather requirements.
5. Define user roles and permissions (B3).
6. Write functional requirements.
7. Write non-functional requirements (B2).
8. Describe the user flow.
9. Design the project workflow (this file).
10. Design the task workflow (§11–§17 and A6).
11. Design the UI/UX.
12. Design the data model (B4).
13. Define the application architecture.
14. Explain the business logic.
15. Write test cases (§36).
16. Compile the final documentation.

---

## 39. Final Presentation — REQUIRED (delivered by the student)

The closing presentation to the instructor or committee.

```
Introduction → Problem Statement → Objectives → Scope → System Features → User Roles → Project Workflow → Task Workflow → UI/UX → Data Model → Architecture → Business Logic → Testing → Results → Conclusion → Q&A
```

1. Introduction
2. Problem Statement
3. Objectives
4. Scope
5. System Features
6. User Roles (system roles and project roles, B3)
7. Project Workflow
8. Task Workflow
9. UI/UX
10. Data Model
11. Architecture
12. Business Logic
13. Testing
14. Results
15. Conclusion
16. Q&A

---

## 40. Live Demo — REQUIRED (delivered by the student)

Shows the application working in practice, from login to project completion. Steps that use an optional feature are labelled.

```
Login → Dashboard → Create Project → Add Team Members → Create Milestone → Create Tasks → Assign Tasks → My Tasks → Update Task Status → Submit & Approve → Add Comment/File → Track Deadline → Show Kanban → Track Progress → Complete Tasks → Complete Project → Generate Report → KPI Dashboard → Logout
```

1. **Login** – Demonstrate authentication (as a Project Manager).
2. **Dashboard** – Show the initial state.
3. **Create Project** – Create a project; the creator becomes Owner.
4. **Add Team Members** – Add a Team Leader and Team Members.
5. **Create Milestone** – Define key checkpoints.
6. **Create Tasks** – Create work items.
7. **Assign Tasks** – Distribute tasks to members.
8. **My Tasks** – A Team Member views their own work.
9. **Update Task Status** – To Do → In Progress → In Review (the member), then approve → Completed (the Owner or Team Leader).
10. **Add Comment/File** – Demonstrate team collaboration (file attachment is REQUIRED).
11. **Track Deadline** – Show upcoming and overdue tasks.
12. **Show Kanban** – Show the task workflow as a board. *Moving cards is an Optional feature demonstration.*
13. **Track Progress** – View task and project progress.
14. **Complete Tasks** – Finish the tasks.
15. **Complete Project** – Project status = Completed.
16. **Generate Report** – Create one of the seven reports. *Export to PDF/Excel is an Optional feature demonstration.*
17. **KPI Dashboard** – Show the final results.
18. **Logout** – End the demo.

Other optional features, if shown (time tracking, Gantt, documents, audit log), are each labelled **Optional feature demonstration**.

---

# Supporting workflows

These requirements appear in the brief (Part A) but have no flow in the 40 above. They are numbered A1–A9 so the 40 keep their numbers.

## A1. User Registration — REQUIRED

```
Register → Enter Name, Username, Email, Password → Validation → Send Verification Code → Enter Code → Account Active → Login
```

1. Open the registration page.
2. Enter full name, username, email and password (at least 8 characters with upper-case, lower-case, digit and special character).
3. Validate (unique username and email).
4. The system emails a one-time code; the account is *Pending verification* and cannot sign in.
5. The user enters the code.
6. The account becomes Active with the system role **User**.
7. The user logs in (§1). A User cannot create projects until an Administrator makes them a Project Manager (§3).

## A2. Change Password & Logout — REQUIRED

```
Profile → Change Password → Enter Current & New Password → Validation → Save → Logout
```

1. Open Profile → Password.
2. Enter the current password, the new password and its confirmation.
3. Validate (password rules; current password correct; confirmation matches).
4. Save.
5. **Logout** ends the session from any screen.

## A3. Session Management & Auto-Logout — REQUIRED (auto-logout is a prototype)

```
Login → Session Starts → Activity Keeps It Alive → Inactivity Warning → Auto-Logout → Login Screen
```

1. A signed session starts at login and has a limited lifetime.
2. A session stops working at once if the account stops being Active.
3. After a period of inactivity the user is warned, then logged out automatically (prototype; the timeout value is not defined).
4. Logout ends the session. Unsaved changes are warned about.

## A4. Task Dependencies — REQUIRED

```
Task B → Add Dependency → Select Task A (must finish first) → Validate (no cycle, same project) → Save → B Waits → A Completed → B Ready
```

1. Open a task and add a dependency: "Task A blocks Task B".
2. Validate: no self-dependency, no cycle, both in the same project (needs the Assign permission).
3. While A is not Completed, B cannot move to In Progress, In Review or Completed (To Do and Cancelled remain allowed); the board and lists show B as *blocked*.
4. When A is Completed, B is ready.
A dependency is not a subtask.

## A5. Project Timeline — REQUIRED

```
Project Detail → Timeline → Load Project, Milestone and Task Dates → Display on a Time Axis → Select Item → View Detail
```

1. Open the project's timeline.
2. Show the project start and end, milestone dates, task start dates and task due dates.
3. Select an item to view or (with the Edit permission) edit it.

## A6. Task Approval — REQUIRED (defines the Approve permission)

```
Task In Progress → Submit for Review → In Review + Approval Requested → Approver Decides → Approved / Changes Requested / Rejected
```

1. The doer (or anyone with Edit) moves the task to **In Review**; an approval request is recorded and the approver is notified.
2. The approver is the person designated on the task (set by the Owner or a Team Leader), or any person who may Approve: Administrator, Project Manager (through the Owner or Team Leader role), Owner, Team Leader.
3. The approver decides:
   - **Approved** → the task may be set to Completed;
   - **Changes requested** → the task returns to In Progress with a comment;
   - **Rejected** → the approver reopens it (In Progress) or cancels it (D-05).
4. Members and Viewers cannot approve. A Member can never set Completed.
5. Every request and decision is written to the activity log and notified (B9).

## A7. Audit Log — OPTIONAL

```
Sensitive Action → Capture Actor, Target, Before and After → Save (append-only) → Administrator Views
```

Records, for the Administrator: system role changes, permission changes, project role changes, ownership transfers, account creation/deletion/activation/suspension, project deletion. Separate from the activity log (§33). Contents: B10.

## A8. Gantt Chart Prototype — OPTIONAL

```
Project → Gantt → Load Tasks and Dependencies → Draw Duration Bars on a Time Axis → Show Overlaps and Dependencies
```

An **Optional feature demonstration** showing the project timeline, task duration, start and end dates and task dependencies.

## A9. Document Management — OPTIONAL

```
Project/Task → Documents → Choose Type (Requirement, Design, Meeting, Testing, Report) → Upload → Link to Project/Task → List/Download
```

An **Optional feature demonstration** for organising documents by type; attachments (§25) are the required basic form.
