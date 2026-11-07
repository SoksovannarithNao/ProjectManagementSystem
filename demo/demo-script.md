# TaskFlow demo: voice-over script

## Before recording

- E-mail must be delivered: S04 (sign-up code) and S30 (administrator sign-in code) both send a real e-mail.
- S30 needs `ADMIN_2FA_ENABLED=true` on the backend. It is `false` by default, and then the administrator signs in with the password alone.
- The Google button (S03, S34) only appears when the backend has a Google client ID. Without one, cut those sentences.
- Accounts used: a new account made in S03, `pm.olivia` (Project Manager), `lead.owen` (Team Leader), `dev.mia` (Team Member) and `admin.system` (Administrator).
- No screen links a task to a milestone, so the script does not show it.

## S01: Welcome to TaskFlow

This is TaskFlow, a project and task management web application. Teams use it to plan projects, split the work into tasks, follow deadlines, and see where everything stands. What each person can see and do is controlled by their role. In this video, we follow one project from start to finish: a new user signs up, a Project Manager sets up the project, a Team Member does the work, a Team Leader approves it, and an Administrator looks after the whole workspace.

## S02: The home page

Before signing in, visitors see the home page. It explains what TaskFlow does: projects and milestones, tasks with subtasks and checklists, a board and a calendar, roles and approvals, notifications and deadlines, and a dashboard with reports. From here, you can sign in, or create an account.

## S03: Create an account

Let's create an account. We choose a username, enter an e-mail address, and pick a password. The checklist under the password updates as we type: at least eight characters, an uppercase letter, a lowercase letter, a number and a special character. The form will not accept a weak password, or a confirmation that doesn't match. When the workspace has set it up, people can also sign up with their Google account instead.

## S04: Verify the e-mail address

TaskFlow now e-mails a six-digit code to prove the address is real. We type the code in and press Verify. If the code doesn't arrive, it can be sent again after a one-minute wait. The account is now verified, and it starts as a regular user.

## S05: A new user's first sign-in

We sign in with the new account. The dashboard shows only zeros for now, because nobody has added this person to a project yet. That's how TaskFlow works: people only see the projects they belong to. Let's sign out, and switch to a Project Manager.

## S06: The Project Manager's dashboard

Olivia is a Project Manager. Her dashboard sums up everything she can see. The cards at the top show her total, active, completed and delayed projects, the average completion, and her total tasks, with how many are done or overdue. Below, the task overview breaks the work down by status, the due and overdue list shows what needs attention first, and delayed projects are flagged on the right.

## S07: Create a project

By default, only Administrators and Project Managers can create projects, so only they see the New Project button. Olivia enters a name, a priority, a start date, an end date and a short description. TaskFlow gives the project a code automatically, and whoever creates a project becomes its Owner.

## S08: The project page

Every project has its own page. At the top are the project code and the manager, then the status, the priority, the dates, and a progress bar that is calculated from the project's tasks. Olivia changes the status from Planning to In Progress. Further down are the task list, the members, the milestones, the project's files, and an activity feed that records every change.

## S09: Invite the team

Next, Olivia builds the team. She opens Add member, searches for Owen, and chooses his role in this project: Team Leader. An invitation can carry one of three roles: Team Leader, Team Member or Viewer. The Owner role belongs to whoever created the project. She invites Mia as a Team Member in the same way. Until they answer, both are listed as pending invitations, and Olivia can still cancel one.

## S10: Accept the invitation

An invitation is only a question. Nobody joins a project until they say yes. Owen signs in, and his bell shows Olivia's invitation. He accepts it, and becomes a member of the project with the role she chose. He could also decline it. Mia does the same.

## S11: Name the project lead

Back with Olivia. Owen and Mia now appear in the members list. As the Owner, Olivia makes Owen the project's lead, and his name now shows at the top of the project page, next to hers.

## S12: Plan a milestone

Projects are planned with milestones. Olivia adds one called Launch, with a due date that has to fall inside the project's dates. Each milestone has its own status, and it appears on the project's timeline and in the calendar.

## S13: Add and assign a task

Now for the work itself. Olivia adds a task: Build the one-page checkout form. She gives it a high priority, a due date, an estimate of six hours, and assigns it to Mia. Only members of the project can be assigned, and the person assigned is notified straight away.

## S14: Dependencies

Some work can only start when other work is finished. Olivia adds a second task, Launch the checkout page, and sets it to depend on the checkout form. Until the form is finished, the new task counts as blocked. Dependencies appear in the task's panel and on the Gantt chart, which also warns when a task is set to start before the task it depends on is due.

## S15: Notifications

Let's sign in as Mia, the Team Member. The bell at the top shows her notifications: the task she has just been given, and any changes to her work. TaskFlow also sends reminders three days and one day before a deadline, and a notice when a task becomes overdue.

## S16: The Tasks page

The Tasks page lists every task in Mia's projects, grouped by project and then by status. The quick views at the top pick out today's, upcoming, in progress, completed and overdue work. There's also a search box, filters for priority, status, assignee, due date and project, and several ways to sort.

## S17: Working on a task

Mia opens her task, and the detail panel slides in. She moves it from To Do to In Progress. She breaks the work into two subtasks, and adds a checklist item for testing. Every change is saved straight away, and recorded in the project's activity history.

## S18: Files

Mia attaches a wireframe to the task, so everyone works from the same design. Files can be added to a task or to the whole project. Each file is limited in size, and file types that aren't allowed are refused.

## S19: Time tracking

Next, she logs the time she spent: two and a half hours, with a short note. She could also start a timer instead. Logged time is compared with the task's estimate, so the team can see how many hours are left.

## S20: Comments and mentions

Then she leaves a comment for Owen. Typing the at sign shows a list of project members, and mentioning someone sends them a notification. Comments can be answered with a reply, and the author can edit or delete their own comment.

## S21: Submit for review

When the work is done, Mia ticks off her subtasks and the checklist item, and submits the task for review. A task can't be completed while it still has open subtasks. The task now waits for approval, and Mia can't approve her own work.

## S22: The Kanban board

The Kanban board shows the same tasks as cards, in columns for each stage: to do, in progress, in review, blocked and completed. Mia's task is now in review, and the launch task waits in the blocked column. Cards can be dragged from one column to another, or moved with their move button. Each card shows the project, the priority, the time spent, and the due date.

## S23: Approve the work

Now Owen, the Team Leader, signs in. His bell tells him a task is waiting for review, and the same request appears in a yellow block at the top of his Tasks page. He opens the task, adds a comment, and approves it. He could also request changes or reject the work, and in both cases a comment is required, so Mia knows what to fix. Once approved, the task is completed.

## S24: Progress follows the work

Back with Olivia. The project's progress has updated by itself from its tasks, the completed task is crossed out in the list, and the launch task is no longer blocked. As the Owner, Olivia can also edit the project, or delete it after a confirmation.

## S25: Team tasks and workload

From the project page, four views show the work from different angles. Team tasks lists each member's tasks, and lets the managers reassign them. Workload compares each person's assigned, active and overdue tasks, and their estimated and actual hours, with the team average, and marks them as overloaded, balanced or underloaded.

## S26: Timeline and Gantt

The timeline places the project, its milestones and its tasks on one time axis, with today marked. The Gantt chart shows each task as a bar, coloured by status, with the dependencies drawn between them.

## S27: The calendar

The calendar shows task due dates and milestones by month, by week, or by day. Clicking a task opens that day in a side drawer, with the task's details beside it. The New Event button creates a task with the date already filled in.

## S28: Reports and KPIs

Reports turn the data into charts and numbers. The overview shows the task counts, completion over time, team productivity, and the progress of each project. The KPI tab calculates the project and task completion rates, the overdue rate, the on-time rate, and the average completion time. There are also seven named reports, from a single project to team performance and workload. Olivia opens the report for her project, and exports it to Excel. PDF works the same way.

## S29: The team directory

The Team page is a directory of everyone in the workspace. Selecting a person shows their e-mail, their assigned tasks, their position and department, and the projects they belong to, with each project's progress. Managers can invite people into their projects from here too.

## S30: The administrator's sign-in

Finally, the Administrator. Because this account has the most power, signing in takes a second step: after the password, TaskFlow e-mails a six-digit sign-in code, and the session only starts once that code is entered.

## S31: Users

On the Users page, the Administrator manages every account. They can change a person's system role, edit their details, or set an account to inactive or suspended. They can also delete an account after a confirmation, and TaskFlow suggests making it inactive instead, so the history is kept.

## S32: Roles and permissions

Roles and Permissions shows exactly what each role may do, as a grid of seven permissions: view, create, edit, delete, assign, approve, and generate reports. One grid covers the whole system, and one covers what happens inside a project. The Administrator can tick or untick permissions, and create extra roles. The Administrator role itself is locked, and always keeps every permission.

## S33: The audit log

The audit log is a read-only record of every sensitive change: role and permission changes, new and deleted accounts, account status changes, ownership transfers and deleted projects. Each entry shows when it happened, who did it, what changed, and the value before and after. It can be searched, and filtered by action and by date.

## S34: Settings, profile and help

Every user has their own settings. In Settings, they choose a light, a dark or a system theme, and decide whether to receive task notifications. On the Profile page, they update their photo, their details and their password, and can connect a Google account for signing in. Help and Support answers common questions. And for safety, TaskFlow signs people out automatically after a period of inactivity.

## S35: When something goes wrong

If an address doesn't exist, or a page is off limits, TaskFlow shows one clear error page, with a way back to the dashboard, and to help. For a project you're not part of, it simply says the page wasn't found, so nobody can find out which projects exist.

## S36: TaskFlow

That's TaskFlow: projects, tasks, teams, approvals and reports in one place, with every person seeing and doing exactly what their role allows. Thanks for watching.
