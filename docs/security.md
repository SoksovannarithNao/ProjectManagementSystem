# Validation & Security

What the application does to keep data valid and access controlled, and where it falls short. Items marked **(verified live)** were confirmed against the running application on 2026-10-06; items marked **(by code reading)** were not exercised; anything unclear is marked **Needs clarification**. Open problems are tracked in [issues.md](issues.md).

## 1. Defence in depth

| Layer | Mechanism | Examples |
|---|---|---|
| Browser | form validation, hidden controls | password checklist, date-order check, `api/permissions.js` hiding buttons |
| API entry | Spring Security filter chain, Bean Validation | JWT check, `@Valid` request DTOs, `@Pattern` enums |
| Service | explicit rule checks | `ProjectAccessGuard`, last-owner protection, invitation eligibility |
| Database | `CHECK`, `UNIQUE`, FK, triggers | date ranges, dependency order, assignee eligibility, progress |

The UI checks are conveniences only; the backend and database repeat every rule that matters.

## 2. Password validation and storage

- Policy (8+ chars, upper, lower, digit, special) — single source `dto/PasswordPolicy.java`, mirrored in `frontend/src/api/validation.js`; details and where it applies in [authentication-authorization.md](authentication-authorization.md#4-password-policy).
- Hashed with **BCrypt** (`BCryptPasswordEncoder`) on registration, admin create/update and change-password; never returned by any DTO (`UserResponse` has no password field; `UserServiceTest` asserts hashing and non-leakage).
- Changing a password requires the current password.
- The OTP code is hashed with the same encoder; the plaintext exists only in the outgoing email.
- Not present: forgot-password flow, lockout of the *change-password* endpoint, breached-password checks, password history/expiry.

## 3. Authentication security

| Control | Detail | Source |
|---|---|---|
| Stateless JWT | HS512, `sub`, optional `role`, expiry 1 h by default | `JwtService`, `SecurityConfig` |
| Secret handling | `JWT_SECRET` from the environment; a startup warning if it is still the built-in development value | `JwtSecretGuard` |
| Login throttling | 5 failures / 15 min per `remoteAddr:username` → `429`; in memory | `LoginRateLimiter` |
| Per-request account check | token rejected (`401`) as soon as the account is not `ACTIVE`, even before the token expires | `ActiveAccountJwtValidator`, `SecurityConfig.jwtDecoder` |
| Uniform login failure | one `401` message for unknown user, wrong password and non-active account **(verified live)** | `AuthService`, `GlobalExceptionHandler` |
| Email verification | 6-digit `SecureRandom` code, bcrypt-hashed, 10 min expiry, 5 attempts, 60 s resend cooldown | `OtpService` |
| Unverified accounts | cannot log in | `CustomUserDetailsService` |
| Session ends | client deletes the token; `401` on any call also logs out | `api/client.js` |

**Gaps:**

1. ~~Existing tokens survived account deactivation~~ — **fixed 2026-10-06.** Previously a token kept working after the account was `SUSPENDED` (verified live). Now `ActiveAccountJwtValidator` runs while every JWT is decoded and rejects a token whose account is missing or not `ACTIVE` with `401`, at the cost of one small status query per request (verified live and by `permissions.spec.js`). Still absent: a revocation list for *active* accounts (for example forced logout) and refresh-token rotation.
2. **Username/email enumeration (verified live).** Login is uniform, but `POST /api/auth/resend-otp` and `/verify-otp` answer `404 "User not found"` for an unknown username and `400 "This account is already verified"` for a real verified one, and registration answers `"Username is already taken"` / `"Email is already registered"`.
3. **Rate-limit key behind the proxy — Needs verification.** The key uses `HttpServletRequest.getRemoteAddr()`. In the Docker stack the backend sits behind nginx, and `application.properties` sets no forwarded-header handling, so by code reading the address is probably the nginx container's for every user; that would make the limit effectively per username across all clients (a lockout of one account affects everyone). Not tested.
4. **Abandoned registrations keep their username and email reserved** indefinitely (no expiry job).
5. The token lives in `localStorage` (`taskflow.auth`), readable by any script running on the page; there is no `HttpOnly` cookie alternative.

## 4. Authorization enforcement

- **Where:** almost every rule is in service code via `ProjectAccessGuard`; `@PreAuthorize("hasRole('ADMINISTRATOR')")` is used only for system-wide actions (user and role management, creating positions/departments). See [authentication-authorization.md](authentication-authorization.md).
- **Scoping reads:** list endpoints first load the caller's active project ids and filter; single-resource endpoints call `assertAccess`.
- **Non-disclosure:** `assertAccess` and notification lookups answer `404`, not `403`.
- **Self-service endpoints** (`/api/users/me*`, `/api/notifications*`, accept/decline) take the target from the token; there is no id to tamper with. The self-profile DTO has no role or status field, so a user cannot escalate.
- **Invariants:** last-owner protection (service + trigger), assignees must be active members (trigger).
- **Frontend:** `api/permissions.js` mirrors the rules to hide actions; it is not a security boundary.

**Fixed on 2026-10-06** (each verified live before the fix and covered by tests afterwards; see [issues.md](issues.md#5-fixed) F-12 … F-18):

| Was | Now |
|---|---|
| Any authenticated user could read any user's full profile by id or username | Scoped: administrator, the user themself, or someone sharing an active project; everyone else gets the same `404` as for a nonexistent user |
| Any authenticated user could list any user's project memberships | Non-administrators see only the user's **active** memberships in projects they belong to |
| A project owner/admin could move a task into any project | Moving needs manage rights on the **target** project too (`403`) |
| `PUT` milestone / membership could re-point the row | Milestone: target-project check. Membership: only the role can change (`400` otherwise) |
| `VIEWER` could add comments and subtasks; an assigned `VIEWER` could change task status | Content-edit rights (`OWNER`/`ADMIN`/`MEMBER`) are required; the UI hides the controls |

**Still open:**

| # | Gap | Evidence |
|---|---|---|
| A7 | System roles can be renamed or deleted through `/api/roles` although the code identifies them by name | by code reading (I-10) |
| A8 | Team page offers "+ Add New" position/department to project owners/admins, but the endpoints are administrator-only (`403`) | by code reading; backend `403` verified for a non-admin (X-01) |
| A9 | Raw PostgreSQL text for `CHECK` and most unique violations (information leak, poor UX) | verified live (I-11) |
| A10 | Username/email enumeration through `resend-otp`/`verify-otp` and registration | verified live (I-08) |
| A11 | Login rate limit key probably identical for all clients behind nginx | needs verification (I-09) |

## 5. Input validation

**Backend (Bean Validation, `@Valid` on every `@RequestBody`)** — required fields (`@NotBlank`, `@NotNull`), lengths (`@Size`), format (`@Email`, username pattern `[A-Za-z0-9._-]+`, OTP `\d{6}`, password regex), enum-like fields pinned with `@Pattern` to the values the database `CHECK` allows, numeric ranges (`@DecimalMin`/`@DecimalMax`). Per-DTO details are in [api-reference.md](api-reference.md).

**Path and query values** — a wrong type (`/api/tasks/abc`) → `400 "Invalid value for 'id'"`; a missing required parameter → `400`; `GET /api/tasks/status/{status}` is checked against the allowed set. **(verified live)**

**File upload** — profile photo only: non-empty, content type one of `image/jpeg`, `image/png`, `image/webp`, `image/gif` (so no SVG), max 5 MB (`spring.servlet.multipart`). The content type comes from the client's multipart header; **the bytes are not inspected** (by code reading). Served with that stored type and `X-Content-Type-Options: nosniff` (Spring default).

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
| `AccessDeniedException` | 403 | always the generic message |
| `AuthenticationException` | 401 | `"Invalid username or password"` |
| `TooManyRequestsException` | 429 | |
| `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException`, `HttpMessageNotReadableException`, `MaxUploadSizeExceededException` | 400 | |
| anything else | 500 | generic `"An unexpected error occurred"`; stack trace only in the log |

Errors raised **before** the controller (missing/invalid token) are produced by Spring Security: `401`, empty body.

Why triggers set `ERRCODE '23514'`: PostgreSQL's default error code for `RAISE EXCEPTION` is not mapped by Hibernate to a constraint violation, which used to surface as a `500`; the explicit code makes the handler return a readable `400` (a rule recorded in the init script comments — **new triggers must do the same**).

**Logging.** Handled failures are logged at `WARN` (not found, validation, constraint, access denied, failed login, rate limit); unexpected ones at `ERROR` with a stack trace. Logs go to the console and a rotating file `backend/logs/log.txt` (10 MB per file, 14 days, 100 MB cap; mounted to the host by Docker Compose). `spring.jpa.show-sql=true` also prints every SQL statement (statements, not bound values), which is noisy for a production log.

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

- **Least-privilege database role:** the backend connects as `taskmanager_app` (no `SUPERUSER`/`CREATEDB`/`CREATEROLE`; DML only on the 15 mapped tables) — [ADR-0011](adr/0011-least-privilege-database-role.md).
- **Container:** the backend image runs as a non-root user `spring`.
- **CORS:** allow-list from `app.cors.allowed-origins` (`CORS_ALLOWED_ORIGINS`; default `http://localhost:5173`, `http://localhost:80`), all headers, methods `GET POST PUT PATCH DELETE OPTIONS`, credentials allowed.
- **CSRF:** disabled — acceptable because authentication is a bearer header, not a cookie.
- **Response headers (API):** Spring Security defaults, e.g. `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache, no-store`, `X-XSS-Protection: 0` **(verified live)**.
- **Secrets:** read from environment variables; `.env` is git-ignored; `.env.example` and `docker-compose.yml` contain **development defaults** (database passwords, JWT secret) that must be changed for any real deployment.
- **Not present (confirmed absent from the repository):** HTTPS/TLS configuration, HSTS, a Content-Security-Policy, security headers in `nginx.conf`, an upload virus scan, dependency-vulnerability scanning in CI (a one-off scan of 14 direct dependencies found no known CVEs during the 2026-10-06 Java upgrade — see [changelog.md](changelog.md)), rate limiting other than login and OTP resend. How production traffic is secured is **Unknown / Needs clarification** (the CD pipeline only pushes images).

## 9. Security checklist for contributors

- New endpoint → decide its access rule; use `ProjectAccessGuard`; remember `assertAccess` returns `404` by design. Check the permission against the **target** project when a request body can change `projectId`.
- New table → add a `GRANT` to `database/init/03-app-role.sh` **and** the duplicate in `.github/workflows/ci.yml`.
- New cross-row rule as a trigger → `USING ERRCODE = '23514'`, and add the same change to a new Flyway migration.
- New user-visible error → throw `IllegalArgumentException`/`ConflictException` with a human sentence rather than relying on a database message.
- Never return an entity; add a DTO that omits sensitive fields.
