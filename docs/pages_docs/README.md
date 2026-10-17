# Pages

One short document per screen of the front end: what it is for, how it works and what it reads. The source of each page is in [frontend/src/pages/](../../frontend/src/pages/). Routes are declared in [App.jsx](../../frontend/src/App.jsx). Rights named here (for example `TASK:ASSIGN`) are the permissions of the [roles and permissions grid](admin-roles-permissions.md); how the front end uses the rest of the app is in [../frontend.md](../frontend.md).

Every page except Login, Register, Verify OTP, the home page (for a signed-out visitor), the Privacy Policy and the Terms of Service sits behind sign-in and inside the app layout (sidebar, top bar, notification bell). The four public pages that are not forms use the lighter public frame (header, footer, theme button).

| Page | Route | Access | Doc |
|---|---|---|---|
| Login | `/login` | public | [login.md](login.md) |
| Register | `/register` | public | [register.md](register.md) |
| Verify OTP | `/verify-otp` | public | [verify-otp.md](verify-otp.md) |
| Home (landing page) | `/` | public while signed out (the Dashboard when signed in) | [home.md](home.md) |
| Privacy Policy | `/privacy-policy` | public | [privacy-policy.md](privacy-policy.md) |
| Terms of Service | `/terms-of-service` | public | [terms-of-service.md](terms-of-service.md) |
| Dashboard | `/` | signed in | [dashboard.md](dashboard.md) |
| Tasks | `/tasks` | signed in | [tasks.md](tasks.md) |
| Projects | `/projects` | signed in | [projects.md](projects.md) |
| Project Detail | `/projects/:id` | project members, Administrator | [project-detail.md](project-detail.md) |
| Project Views (team, workload, timeline, gantt) | `/projects/:id/:view` | members; team and workload need `TASK:ASSIGN` | [project-views.md](project-views.md) |
| Calendar | `/calendar` | signed in | [calendar.md](calendar.md) |
| Kanban Board | `/kanban` | signed in | [kanban.md](kanban.md) |
| Team | `/team` | signed in | [team.md](team.md) |
| Reports | `/reports` | `REPORT:GENERATE_REPORTS` | [reports.md](reports.md) |
| Users | `/admin/users` | `USER:VIEW` | [admin-users.md](admin-users.md) |
| Roles & Permissions | `/admin/roles` | `ROLE:VIEW` | [admin-roles-permissions.md](admin-roles-permissions.md) |
| Audit log | `/admin/audit` | Administrator | [admin-audit-log.md](admin-audit-log.md) |
| Profile | `/profile` | signed in | [profile.md](profile.md) |
| Settings | `/settings` | signed in | [settings.md](settings.md) |
| Help & Support | `/help` | signed in | [help-and-support.md](help-and-support.md) |
| Error page | `/error/:status`, unknown address | signed in | [error-page.md](error-page.md) |

Shared pieces that appear on several pages (the task detail panel, the task and project forms, the notification bell) are components, not pages, and are not described one by one here.
