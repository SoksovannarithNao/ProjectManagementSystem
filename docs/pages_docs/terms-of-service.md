# Terms of Service

**Route** `/terms-of-service` · **Access** public (signed in or not) · **Source** [TermsOfService.jsx](../../frontend/src/pages/TermsOfService.jsx), layout [LegalDocument.jsx](../../frontend/src/components/public/LegalDocument.jsx)

## What it does
Sets out the rules of using TaskFlow: the agreement, accounts, acceptable use, ownership of content, how projects and roles work, availability, suspension and ending an account, a disclaimer, changes and contact.

## What it reflects in the application
- **Accounts:** created by an administrator, or self-registered and confirmed with an e-mailed code; sign-in lock-out and idle sign-out are described as security measures.
- **Content:** attachments are limited to 10 MB and checked by type (`FileTypeGuard`).
- **Roles:** what a person can do depends on the project role (Project Manager, Team Leader, Team Member, Viewer) and the permission grid; administrators manage accounts, roles and permissions and can see every project.
- **Records:** the activity history and the administrator audit log, described in the [Privacy Policy](privacy-policy.md).
- **Closed work:** a completed project or task takes no new tasks, comments, files or time entries (D-27).
- **Suspension:** an administrator can deactivate, suspend or delete an account; such an account cannot sign in.

## Notes
- Operator name and contact e-mail come from `config/site.js`; the date is `termsUpdated`.
- It is a plain-language starting point, not legal advice. It names no governing law, company or address: add them in the page if you need them.
- Why it exists: the Google OAuth consent screen needs a public terms page ([../google-oauth-verification.md](../google-oauth-verification.md)).
