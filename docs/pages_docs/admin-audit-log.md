# Audit log (administration)

**Route** `/admin/audit` · **Access** Administrator only · **Source** [AuditLog.jsx](../../frontend/src/pages/admin/AuditLog.jsx)

## What it does
A read-only record of sensitive changes: who did what, to which account, role or project, when, and the value before and after. There is nothing to edit or delete.

## How it works
- A table with the columns **When, Who, What, On, Change**, newest first, 25 rows a page with **Previous / Next** and a "1–25 of N" counter.
- **What** is one of: System role changed, Permissions changed, Project role changed, Ownership transferred, Account created, Account status changed, Account deleted, Project deleted, Role created, Role updated, Role deleted.
- **Change** shows `before → after`. For a permission change it lists what was **Added** and **Removed**, each as "Resource: Permission (anywhere / in a project)".
- **Filters:** free-text search in the top bar (waits 300 ms), an action dropdown and a From / To date range. Any filter returns to the first page; **Clear filters** resets all of them.
- Empty states distinguish "nothing recorded yet" from "no entries match your filters"; a failed request shows "Could not load the audit log" with the reason.
- A project's Owner can also see that project's ownership events through the API; the page itself opens only for the Administrator.

## Data
`getAuditLogs()` in `api/auditLog.js` (search, action, date range, page, size).
