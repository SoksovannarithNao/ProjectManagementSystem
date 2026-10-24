# Validation & Security

What the application does to keep data valid and access controlled, and where it falls short. Items marked **(verified live)** were confirmed against the running application on 2026-10-06; items marked **(by code reading)** were not exercised; anything unclear is marked **Needs clarification**. Open problems are tracked in [issues.md](issues.md).

## 1. Defence in depth

| Layer | Mechanism | Examples |
|---|---|---|
| Browser | form validation, hidden controls | password checklist, date-order check, controls hidden from the server's permission list |
| API entry | Spring Security filter chain, Bean Validation | JWT check, `@Valid` request DTOs, `@Pattern` enums |
| Service | explicit rule checks | `ProjectAccessGuard`, last-owner protection, invitation eligibility |
| Database | `CHECK`, `UNIQUE`, FK, triggers | date ranges, dependency order, assignee eligibility, progress |

The UI checks are conveniences only; the backend and database repeat every rule that matters.

## 2. Password validation and storage

- Policy (8+ chars, upper, lower, digit, special) — single source `dto/PasswordPolicy.java`, mirrored in `frontend/src/api/validation.js`; details and where it applies in [authentication-authorization.md](authentication-authorization.md#4-password-policy).
- Hashed with **BCrypt** (`BCryptPasswordEncoder`) on registration, admin create/update and change-password; never returned by any DTO (`UserResponse` has no password field; `UserServiceTest` asserts hashing and non-leakage).
- Changing a password requires the current password.
- The OTP code (registration, and the administrator's sign-in code) is hashed with the same encoder; the plaintext exists only in the outgoing email.
- Not present: forgot-password flow, lockout of the *change-password* endpoint, breached-password checks, password history/expiry.

## 3. Authentication security

| Control | Detail | Source |
|---|---|---|
| Stateless JWT | HS512, `sub`, optional `role`, expiry 15 min by default, kept in the browser's memory | `JwtService`, `SecurityConfig` |
| Refresh cookie | random 256-bit token, `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, 7 days; only its SHA-256 hash is stored; deleted on sign-out, a password change or reset, and refused for an account that is not `ACTIVE` | `RefreshTokenService`, `AuthController`, table `refresh_tokens` |
| Secret handling | `JWT_SECRET` from the environment; a startup warning if it is still the built-in development value | `JwtSecretGuard` |
| Login throttling | 5 failures / 15 min per `clientAddress:username` → `429`; in memory; the address is the real client's behind nginx (since 2026-10-14) | `LoginRateLimiter` |
| Per-request account check | token rejected (`401`) as soon as the account is not `ACTIVE`, even before the token expires | `ActiveAccountJwtValidator`, `SecurityConfig.jwtDecoder` |
| Uniform login failure | one `401` message for unknown user, wrong password and non-active account **(verified live)** | `AuthService`, `GlobalExceptionHandler` |
| Email verification | 6-digit `SecureRandom` code, bcrypt-hashed, 10 min expiry, 5 attempts, 60 s resend cooldown | `OtpService` |
| Administrator sign-in code | optional second step for `ADMINISTRATOR` accounts (`ADMIN_2FA_ENABLED`, default off): after the right password no session starts until the e-mailed 6-digit code is entered (`POST /api/auth/login/verify`); the code is hashed, expires after 10 min and allows 5 attempts; wrong codes and failed passwords share the same lock-out; every failure answers alike; a code sent inside the 60 s cooldown is kept, not replaced | `AuthService`, `OtpService`, `LoginRateLimiter` |
| Google ID token | "Sign in with Google" (optional, off while `GOOGLE_CLIENT_ID` is blank): the token is verified on the server against Google's public keys: signature, expiry, issuer, and audience = this app's client ID; a token made for another app, an expired or a forged one is refused with one message. No client secret is involved | `GoogleTokenVerifier` |
| Google account link | link-and-create ([ADR-0017](adr/0017-link-only-google-sign-in.md), [ADR-0018](adr/0018-google-sign-up-and-first-password.md)): a Google account is known by its stable id (`sub`), never by e-mail (an account's e-mail can be edited unverified); an existing account is connected from Profile with the current password; a Google account connected to nobody may create a new `USER` account only when Google vouches for its e-mail and no account uses it (otherwise it is refused, never attached); a new account has no password until it sets one, confirmed with Google (`password_set`); the account must be `ACTIVE`, an administrator still enters the e-mailed code, and failures share the sign-in lock-out (key `address:google`) | `GoogleSignInService`, `AuthService.loginWithGoogle` / `registerWithGoogle`, tables `user_identities` and `users.password_set` |
| Mail route | SMTP (Mailpit locally) or the Gmail API over HTTPS when the three `GMAIL_*` values are set; a failed hand-over is a `503` that names no provider; the Gmail credentials are server configuration, never stored in the database | `MailService`, `GlobalExceptionHandler` |
| Unverified accounts | cannot log in | `CustomUserDetailsService` |
| Session ends | sign-out calls `POST /api/auth/logout` (deletes the refresh token, clears the cookie) and the browser forgets who signed in; a `401` that a refresh cannot fix also logs out; after 15 idle minutes (60-second warning) the app signs out by itself, since 2026-10-12. The 15-minute access token cannot be recalled, it expires | `api/client.js`, `auth/IdleLogout.jsx`, `AuthController` |

**Gaps:**

1. ~~Existing tokens survived account deactivation~~ — **fixed 2026-10-06.** Previously a token kept working after the account was `SUSPENDED` (verified live). Now `ActiveAccountJwtValidator` runs while every JWT is decoded and rejects a token whose account is missing or not `ACTIVE` with `401`, at the cost of one small status query per request (verified live and by `permissions.spec.js`). Still absent: a revocation list for *active* accounts (for example forced logout) and refresh-token rotation.
2. ~~**Username/email enumeration (verified live).**~~ — **fixed for the code endpoints 2026-10-14 (I-08):** `POST /api/auth/verify-otp` answers every failure alike and `/resend-otp` answers `200` for an unknown or verified account. **Accepted:** registration still answers `"Username is already taken"` / `"Email is already registered"`, because a person signing up has to be told. Login is uniform.
3. ~~**Rate-limit key behind the proxy**~~ — **fixed 2026-10-14 (I-09):** reproduced (a second client was locked too), then nginx sends `X-Forwarded-For: $remote_addr` and `server.forward-headers-strategy=native` makes `getRemoteAddr()` the real client; a spoofed header is ignored. The original finding: the key uses `HttpServletRequest.getRemoteAddr()`. In the Docker stack the backend sits behind nginx, and `application.properties` sets no forwarded-header handling, so by code reading the address is probably the nginx container's for every user; that would make the limit effectively per username across all clients (a lockout of one account affects everyone). Not tested.
4. ~~**Abandoned registrations keep their username and email reserved** indefinitely~~ — **fixed 2026-10-14 (I-14):** an hourly job deletes a registration that was not verified within 24 hours.
5. ~~The token lives in `localStorage`~~ — **fixed 2026-10-14 (R-4):** the access token is in memory only and the long-lived credential is an `HttpOnly` cookie. A script running on the page can still *use* the session while the page is open (it can call the API), which no token storage prevents.
6. **Google sign-in: what is not covered (2026-10-24).** No `nonce` is sent or checked on the ID token, connecting or disconnecting is not written to the audit log (creating an account is: `ACCOUNT_CREATED`), and connecting does not count wrong passwords toward a lock-out (as for changing a password). Anyone with a Google account that has a verified e-mail can create a `USER` account (no wider than `/register`); someone who edits their own profile e-mail to another person's address stops that person creating an account with Google (they are told to sign in and connect), which captures nothing. A Google-created account that has not set a password cannot sign in if Google sign-in is switched off, until an administrator resets its password.

## 4. Authorization enforcement

- **Where:** every rule is a row in `role_permissions`, answered by `ProjectAccessGuard` / `PermissionService` in service code; system-wide endpoints (users, roles, the matrix, positions/departments) use `@PreAuthorize("@permissions.require(authentication, 'USER', 'CREATE')")`-style checks. A refused request is `403` with a specific sentence. `ADMINISTRATOR` bypasses the check in code, so the matrix can never lock it out. See [authentication-authorization.md](authentication-authorization.md).
- **Scoping reads:** list endpoints first load the caller's active project ids and filter; single-resource endpoints call `assertAccess`.
- **Non-disclosure:** `assertAccess` and notification lookups answer `404`, not `403`.
- **Self-service endpoints** (`/api/users/me*`, `/api/notifications*`, accept/decline) take the target from the token; there is no id to tamper with. The self-profile DTO has no role or status field, so a user cannot escalate.
- **Invariants:** last-owner protection (service + trigger), assignees must be active members (trigger).
- **Frontend:** the UI reads the caller's permission list from the server (`GET /api/users/me/permissions`) and hides what it would refuse; it is not a security boundary.
- **Editing the matrix** (`PUT /api/roles/{id}/permissions`) needs `ROLE:EDIT`. The Administrator role is locked, a project role cannot lose `PROJECT:VIEW`, and the last Administrator cannot be demoted. **Reports:** `REPORT:GENERATE_REPORTS` is checked on the server by every `/api/reports/*` endpoint (`ReportService`: an Administrator all projects, anyone else only the projects where they hold it; `403` / `404` otherwise; 2026-10-09). **Remaining gap:** the Reports *Overview* charts read `/api/tasks` and friends, so that task data is reachable by anyone who may see the tasks.

**Fixed on 2026-10-06** (each verified live before the fix and covered by tests afterwards; see [issues.md](issues.md#5-fixed) F-12 … F-18):

| Was | Now |
|---|---|
| Any authenticated user could read any user's full profile by id or username | Scoped: administrator, the user themself, or someone sharing an active project; everyone else gets the same `404` as for a nonexistent user |
| Any authenticated user could list any user's project memberships | Non-administrators see only the user's **active** memberships in projects they belong to |
| A project owner/admin could move a task into any project | Moving needs the right to edit tasks in the **target** project too (`403`) |
| `PUT` milestone / membership could re-point the row | Milestone: target-project check. Membership: only the role can change (`400` otherwise) |
| `VIEWER` could add comments and subtasks; an assigned `VIEWER` could change task status | The matching `COMMENT:CREATE` / `SUBTASK:CREATE` / `TASK_STATUS:EDIT` grant is required (a Viewer has none); the UI hides the controls |

**Still open:**

| # | Gap | Evidence |
|---|---|---|
| A7 | System roles can be renamed or deleted through `/api/roles` although the code identifies them by name | by code reading (I-10) |
| A8 | Team page offers "+ Add New" position/department to project owners/admins, but the endpoints are administrator-only (`403`) | by code reading; backend `403` verified for a non-admin (X-01) |
| A9 | ~~Raw PostgreSQL text for `CHECK` and most unique violations~~ — fixed 2026-10-14 (`DatabaseMessages`) | I-11 |
| A10 | ~~Username/email enumeration through `resend-otp`/`verify-otp`~~ — fixed 2026-10-14; registration still says a name is taken (accepted) | I-08 |
| A11 | ~~Login rate limit key identical for all clients behind nginx~~ — fixed 2026-10-14 | I-09 |

## 5. Input validation

**Backend (Bean Validation, `@Valid` on every `@RequestBody`)** — required fields (`@NotBlank`, `@NotNull`), lengths (`@Size`), format (`@Email`, username pattern `[A-Za-z0-9._-]+`, OTP `\d{6}`, password regex), enum-like fields pinned with `@Pattern` to the values the database `CHECK` allows, numeric ranges (`@DecimalMin`/`@DecimalMax`). Per-DTO details are in [api-reference.md](api-reference.md).

**Path and query values** — a wrong type (`/api/tasks/abc`) → `400 "Invalid value for 'id'"`; a missing required parameter → `400`; `GET /api/tasks/status/{status}` is checked against the allowed set. **(verified live)**

**File upload** — two places. *Profile photo:* non-empty, content type one of `image/jpeg`, `image/png`, `image/webp`, `image/gif` (so no SVG), max 5 MB (checked in `UserService`). *Attachments* (`AttachmentService`, `util/FileTypeGuard`, since 2026-10-09): needs `ATTACHMENT:CREATE` in the project; an allow-list of extensions (no executables, scripts, HTML or SVG), the first bytes must match the type, plain-text types may hold no NUL bytes, the MIME type is derived from the extension and never taken from the client, names are stripped of folders and control / quote characters, at most 10 MB per file and 25 files per task or project; downloads need a token and are always `Content-Disposition: attachment` with `X-Content-Type-Options: nosniff` and a sandboxing `Content-Security-Policy`, so a stored file can never run in the app's origin. Not done: virus scanning and a per-user upload rate limit. For the **profile photo** the content type comes from the client's multipart header and **the bytes are not inspected** (by code reading); it is served with that stored type and `X-Content-Type-Options: nosniff` (Spring default).

**Frontend** — HTML5 `required`/`min`/`max`/`pattern` attributes; start ≤ end / start ≤ due checks; non-negative hours; live password rules; the user's typed username/search text is only ever sent as data.

**Injection** — all repository access uses Spring Data derived queries or `@Query` with bound parameters; the invitable-user search builds a `LIKE` pattern from user text but escapes `%`, `_` and the escape character, and passes it as a bound parameter (`ProjectMemberService.likePattern`). React escapes rendered text; there is no `dangerouslySetInnerHTML` use found in `src/` (by code reading).

## 6. Error handling

`exception/GlobalExceptionHandler` (`@RestControllerAdvice`) maps exceptions to one JSON shape `{ timestamp, status, error, message, fieldErrors }`:

| Exception | HTTP | Notes |
|---|---|---|
| `NotFoundException` | 404 | message passed through |
| `MethodArgumentNotValidException` | 400 | `"One or more fields are invalid"` + `fieldErrors` |
| `ConflictException` | 409 | e.g. duplicate project code |
| `DataIntegrityViolationException` | 409 for `projects_project_code_key`, otherwise 400 | trigger messages are cleaned (`ERROR: ` prefix and `Where:` line removed); **CHECK and other unique-constraint messages are passed through raw** ⚠ |
| `IllegalArgumentException` | 400 | the service's own sentence |
| `AccessDeniedException` | 403 | the specific sentence thrown by the permission layer; the generic `"You do not have permission to perform this action"` only for Spring's own default text |
| `AuthenticationException` | 401 | `"Invalid username or password"` |
| `TooManyRequestsException` | 429 | |
| `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException`, `HttpMessageNotReadableException`, `MaxUploadSizeExceededException` | 400 | |
| anything else | 500 | generic `"An unexpected error occurred"`; stack trace only in the log |

Errors raised **before** the controller (missing/invalid token) are produced by Spring Security: `401`, empty body.

Why triggers set `ERRCODE '23514'`: PostgreSQL's default error code for `RAISE EXCEPTION` is not mapped by Hibernate to a constraint violation, which used to surface as a `500`; the explicit code makes the handler return a readable `400` (a rule recorded in the init script comments — **new triggers must do the same**).

**Logging.** Handled failures are logged at `WARN` (not found, validation, constraint, access denied, failed login, rate limit); unexpected ones at `ERROR` with a stack trace. Logs go to a rotating file `backend/logs/log.txt` only (10 MB per file, 14 days, 100 MB cap; mounted to the host by Docker Compose); `logback-spring.xml` keeps the console quiet. `spring.jpa.show-sql=true` also prints every SQL statement (statements, not bound values), which is noisy for a production log.

**Frontend.** `ApiError(status, message, fieldErrors)`; pages show `err.message` in a toast or inline text; `passwordErrorMessage` prefers the `fieldErrors` entry. `401` clears the session.

## 7. Database constraints that protect data

Full catalogue in [database.md](database.md). The security-relevant ones:

- unique username and email, case-insensitive (`idx_users_username_lower`, `idx_users_email_lower`); unique project code; one membership per (project, user);
- `CHECK` on every status/priority/role column;
- last active owner of a project cannot be removed, demoted or cascade-deleted;
- task assignees must be active project members with an `ACTIVE` account;
- dates: project `end ≥ start`; task `due ≥ start` and `due ≤ project end`; milestone inside the project range;
- no dependency cycles; no starting a task before prerequisites finish; no completing a task with open subtasks;
- foreign keys with deliberate `ON DELETE` actions (`RESTRICT` on `projects.manager_id` and `users.role_id`).

## 8. Infrastructure and browser-facing measures

- **Least-privilege database role:** the backend connects as `taskmanager_app` (no `SUPERUSER`/`CREATEDB`/`CREATEROLE`; DML only on the 23 read-write tables, `SELECT` on `permissions`, `SELECT` and `INSERT` only on the append-only `audit_logs`) — [ADR-0011](adr/0011-least-privilege-database-role.md).
- **Container:** the backend image runs as a non-root user `spring`.
- **CORS:** allow-list from `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`; default `http://localhost:5173`, `http://localhost:80`), all headers, methods `GET POST PUT PATCH DELETE OPTIONS`, credentials allowed.
- **CSRF:** disabled — acceptable because authentication is a bearer header, not a cookie.
- **Response headers (API):** Spring Security defaults, e.g. `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache, no-store`, `X-XSS-Protection: 0` **(verified live)**.
- **Secrets:** read from environment variables; `.env` is git-ignored; `.env.example` and `docker-compose.yml` contain **development defaults** (database passwords, JWT secret) that must be changed for any real deployment.
- **Not present (confirmed absent from the repository):** HTTPS/TLS configuration in the application itself (in the hosted deployment TLS is terminated by Vercel and Render), HSTS, a Content-Security-Policy, security headers in `nginx.conf`, an upload virus scan, dependency-vulnerability scanning in CI (a one-off scan of 14 direct dependencies found no known CVEs during the 2026-10-06 Java upgrade — see [changelog.md](changelog.md); `npm audit` on the front end reports two high-severity advisories in build-time packages, see I-23 in [issues.md](issues.md)), rate limiting other than login and OTP resend. How production traffic is secured is **Unknown / Needs clarification** (the CD pipeline only pushes images).

## 9. Security checklist for contributors

- New endpoint → decide its access rule as a *(resource, action)* pair; use `ProjectAccessGuard.assertCan` (or a `@PreAuthorize` permission check for system-wide ones) and add the grant rows in a new Flyway migration (see `V13`) and in `01-init.sql`; remember `assertAccess` returns `404` by design. Check the permission against the **target** project when a request body can change `projectId`.
- New table → add a `GRANT` to `database/init/03-app-role.sh` (CI runs that script and then `database/verify_grants.sql`, which fails when a table has no grant) and, for a database that already exists, to the migration that creates it.
- New cross-row rule as a trigger → `USING ERRCODE = '23514'`, and add the same change to a new Flyway migration.
- New user-visible error → throw `IllegalArgumentException`/`ConflictException` with a human sentence rather than relying on a database message.
- Never return an entity; add a DTO that omits sensitive fields.
