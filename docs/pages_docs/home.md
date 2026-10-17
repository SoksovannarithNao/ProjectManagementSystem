# Home (public landing page)

**Route** `/` (signed-out visitors only) · **Access** public · **Source** [Landing.jsx](../../frontend/src/pages/Landing.jsx)

## What it does
Introduces TaskFlow to someone who is not signed in: what it is (a project and task management web application), what it can do, and how to sign in or register.

## How it works
- `/` is a protected address. [ProtectedRoute.jsx](../../frontend/src/auth/ProtectedRoute.jsx) shows this page there when nobody is signed in, and the [Dashboard](dashboard.md) when someone is. Every other protected address still redirects a signed-out visitor to [Login](login.md).
- A hero with the product statement and two buttons, **Sign in** (`/login`) and **Create account** (`/register`); a signed-in person who opens `/privacy-policy` sees **Open TaskFlow** instead.
- Six feature cards taken from what the application does (projects and milestones, tasks and subtasks, board and calendar, roles and approvals, notifications and deadlines, dashboard and reports). No figures, customers or screenshots are claimed.
- An *About this service* block that names the operator and links to the [Privacy Policy](privacy-policy.md), the [Terms of Service](terms-of-service.md) and the contact e-mail.

## Notes
- The frame (skip link, header navigation, theme button, footer with the legal links) is `components/public/PublicLayout.jsx`; its theme button is the shared `components/ui/ThemeToggle.jsx`, the same one-click toggle as the signed-in app's top bar, shared with the two legal pages. It follows the light, dark and system themes and has no horizontal scroll at phone width.
- The operator name and contact e-mail come from `config/site.js`.
- Why it exists: the Google OAuth consent screen needs a public home page; see [../google-oauth-verification.md](../google-oauth-verification.md).
