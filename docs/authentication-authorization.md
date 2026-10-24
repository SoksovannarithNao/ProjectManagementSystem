# Authentication & Authorization

Who a user is, what state their account can be in, and what they are allowed to do. Implementation: `backend/src/main/java/backend/` — `config/SecurityConfig.java`, `service/AuthService.java`, `JwtService.java`, `OtpService.java`, `GoogleSignInService.java`, `GoogleTokenVerifier.java`, `LoginRateLimiter.java`, `CustomUserDetailsService.java`, `ProjectAccessGuard.java`; frontend: `frontend/src/auth/`, `api/permissions.js`.

Behaviours marked **(verified live)** were confirmed against the running application on 2026-10-06.

## 1. Authentication flow

### 1.1 Login

```mermaid
sequenceDiagram
    participant UI as Login page
    participant API as POST /api/auth/login
    participant RL as LoginRateLimiter
    participant AM as AuthenticationManager
    UI->>API: { username, password }
    API->>RL: assertNotLocked(clientAddress:username)
    RL-->>API: 429 if 5 failures in the last 15 min
    API->>AM: authenticate (CustomUserDetailsService + BCrypt)
    AM-->>API: success only if account_status = ACTIVE and password matches
    API->>RL: recordSuccess (clears the counter)
    API-->>UI: { token, username, role }
    UI->>UI: keep the token in memory; store only {username, role} in localStorage "taskflow.auth" (the refresh cookie arrives with the reply)
    UI->>UI: GET /api/users/username/{username} → profile
```

Details:

- **Credential is the username or the e-mail address** (since 2026-10-09). The request field is still called `username`; `AuthService.login` first calls `UserService.resolveLoginIdentifier`, which maps an e-mail address (anything containing `@`, compared case-insensitively) to the account's username, then authenticates as before. A username can never contain `@` (registration forbids it), so the two cannot be confused. The token's subject is always the username. An unknown e-mail falls through to the normal `401 "Invalid username or password"`.
- **Any failure returns the same message** — `401 Unauthorized`, `"Invalid username or password"` — whether the user does not exist, the password is wrong, or the account is not `ACTIVE`. This does not reveal which accounts exist.
- **Rate limiting.** `LoginRateLimiter` keeps failure timestamps in memory, keyed `clientAddress + ":" + <what was typed>` (the address nginx saw, passed in `X-Forwarded-For` and read by Tomcat from a private-network proxy only, since 2026-10-14; before that every client looked like the proxy). After **5** failures within **15 minutes** the next attempt returns `429 Too Many Requests` (`"Too many failed login attempts. Try again later."`). A successful login clears the counter. State is lost on restart and not shared between instances.
- **Token.** `JwtService` issues an HS512-signed JWT with `sub` = username, `iat`, `exp`, and — only when the user has a global role — a `role` claim. Lifetime is `app.jwt.expiration-ms` (`JWT_EXPIRATION_MS`, default `900000` = 15 minutes; it was 1 hour until 2026-10-14). The signing key is `app.jwt.secret` (`JWT_SECRET`); `JwtSecretGuard` logs a warning at startup if it is still the built-in development value.
- **Per request.** Spring's OAuth2 resource server validates the signature and expiry. `SecurityConfig` maps the `role` claim to a `ROLE_<name>` authority (so `@PreAuthorize("hasRole('ADMINISTRATOR')")` works). Services then identify the caller by `authentication.getName()` (the `sub` claim).
- **Public endpoints:** `GET /api/health`, `POST /api/auth/login`, `/login/verify`, `/google`, `/google/register`, `GET /api/auth/google/config`, `/refresh`, `/logout`, `/register`, `/verify-otp`, `/resend-otp`, and `GET /api/photos/**`. Everything else requires a valid token.
- **No token, bad token or expired token** → `401` with an **empty body** (produced by Spring Security's filter, before the exception handler) and a `WWW-Authenticate: Bearer` header **(verified live)**.
- **Sign-out ends the session on the server too (since 2026-10-14).** `AuthContext.logout` calls `POST /api/auth/logout`, which deletes the refresh token and clears the cookie, and removes `taskflow.auth`. A `401` that a refresh cannot fix also logs the user out (`api/client.js`). The 15-minute access token itself is stateless and cannot be recalled: it simply expires (or is refused at once if the account stops being `ACTIVE`, section 1.1).
- **Refresh tokens (since 2026-10-14, risk R-4, D-24).** Sign-in also sets the cookie `taskflow_refresh` (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, 7 days; `Secure` when `REFRESH_COOKIE_SECURE=true`): a random 256-bit value of which only the SHA-256 hash is stored (`refresh_tokens`). `POST /api/auth/refresh` trades it for a new access token, after checking again that the account is `ACTIVE`; so the person is not signed out after 15 minutes of use. It is **not rotated** on use (two tabs refreshing at once would invalidate each other) and is deleted by sign-out, by a changed or reset password (every session of the account) and with the account. The idle auto-logout (15 minutes, section 7) is unchanged.
- **Auto-logout (since 2026-10-12).** After **15 minutes without activity** (mouse, keyboard, wheel, scroll or touch, in this or any other open tab) a *Still there?* dialog counts down **60 seconds** (*Stay signed in* / *Sign out now*); when it runs out the app clears `taskflow.auth` and the login page says it was for inactivity. `auth/IdleLogout.jsx`, limits in `auth/idleTimeout.js`. It is only the browser forgetting the token, like a manual logout: the token stays valid on the server until it expires (default 1 hour).
- **A deactivated account's token is rejected immediately** (fixed 2026-10-06). While every JWT is decoded, `ActiveAccountJwtValidator` looks up the account's *current* status (one small status-only query per request) and returns `401` if the account is missing or not `ACTIVE` — **verified live**: a token that worked returned `401` right after the account was set to `SUSPENDED`, and worked again after it was reactivated (`permissions.spec.js`). Before the fix a token stayed valid until it expired.

### 1.2 Self-registration with email verification

```mermaid
sequenceDiagram
    participant UI as Register / VerifyOtp pages
    participant API as /api/auth/*
    participant DB as users + otp_verifications
    participant Mail as Mailpit (SMTP)
    UI->>API: POST /register { username, email, password, confirmPassword }
    API->>DB: create user, account_status = PENDING_VERIFICATION, role = USER
    API->>DB: store bcrypt hash of a 6-digit code (expires, 5 attempts)
    API->>Mail: send code
    API-->>UI: 201 { username, email, message }
    UI->>API: POST /verify-otp { username, otp }
    API->>DB: check code → account_status = ACTIVE
    API-->>UI: 200
    UI->>UI: user can now log in
```

| Rule | Value | Source |
|---|---|---|
| Username | 3–50 chars; letters, numbers, `.`, `_`, `-` only | `RegisterRequest` |
| Email | valid format, max 255 | `RegisterRequest` |
| Password | see [section 4](#4-password-policy); `confirmPassword` must match | `RegisterRequest`, `UserService.registerSelfServiceUser` |
| Username / email uniqueness | case-insensitive; `"Username is already taken"` / `"Email is already registered"` (400) | `UserService`, indexes `idx_users_username_lower`, `idx_users_email_lower` |
| Code | 6 digits (`SecureRandom`), stored only as a bcrypt hash | `OtpService` |
| Expiry | `app.otp.expiration-minutes` (`OTP_EXPIRATION_MINUTES`), default 10 | `application.properties` |
| Verify attempts | `app.otp.max-attempts` (`OTP_MAX_ATTEMPTS`), default 5; every failure gives the same message, so the attempts left are enforced but not shown (since 2026-10-14, I-08) | `OtpService.verify` |
| Resend cooldown | `app.otp.resend-cooldown-seconds` (`OTP_RESEND_COOLDOWN_SECONDS`), default 60; too soon → `429` | `OtpService.resendOtp` |
| Verify/resend on an already-verified account | `400 "This account is already verified"` | `AuthService` |
| Other verify failures | no code on file, already used, expired, attempts exhausted → `400` with a specific message | `OtpService.verify` |

Notes:

- A new account's `fullName` defaults to its username; the user completes the profile later.
- A `PENDING_VERIFICATION` account cannot log in, **and its username and email stay reserved** — a second registration with the same username fails with "Username is already taken". An account that is not verified within 24 hours (`PENDING_REGISTRATION_TTL_HOURS`) is deleted by an hourly job (`PendingRegistrationScheduler`), which frees the username and e-mail again (since 2026-10-14, I-14).
- Resending a code creates a new `otp_verifications` row; verification always checks the **latest** code only.
- Mail host is `MAIL_HOST` (default `mailpit`). Outside Docker set it to `localhost` — see [setup.md](setup.md). When `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` are all set, codes go through the Gmail API over HTTPS instead of SMTP (hosts that block the SMTP ports, such as Render's free tier); `MAIL_FROM` must then be that Gmail address.
- **Administrator second step (since 2026-10-17, [ADR-0016](adr/0016-admin-two-factor-and-https-mail.md)).** With `ADMIN_2FA_ENABLED=true` (default `false`) a correct password for an `ADMINISTRATOR` does not start a session: `login` answers `202 { twoFactorRequired, username, maskedEmail }` and e-mails a 6-digit code (`otp_verifications.purpose = 'LOGIN_2FA'`); `POST /api/auth/login/verify` checks it and only then issues the access token and refresh cookie. Other roles are unaffected. A wrong code counts toward the same lock-out as a wrong password. Turn it on only when the administrator's e-mail is a real mailbox and a test code arrives, or the administrator cannot sign in (`ADMIN_2FA_ENABLED=false` and a redeploy is the way out).

### 1.3 Sign in with Google (optional)

Since 2026-10-24 ([ADR-0017](adr/0017-link-only-google-sign-in.md), changed in one respect by [ADR-0018](adr/0018-google-sign-up-and-first-password.md); [google-sign-in.md](google-sign-in.md)). Available only when `GOOGLE_CLIENT_ID` is set; otherwise there is no button and every Google endpoint answers `404`. A Google account is known by its stable id (`sub`), **never by e-mail**. Three things can happen to a verified Google ID token:

```mermaid
sequenceDiagram
    participant UI as Sign-in page
    participant G as Google (script and button)
    participant API as POST /api/auth/google
    participant V as GoogleTokenVerifier
    participant DB as user_identities
    UI->>G: the person chooses a Google account
    G-->>UI: signed ID token (credential)
    UI->>API: { credential }
    API->>API: LoginRateLimiter.assertNotLocked(address:google)
    API->>V: verify (Google's public keys, expiry, issuer, audience = our client ID)
    V-->>API: sub, the e-mail Google vouches for, the name
    API->>DB: find the row for ("GOOGLE", sub)
    alt connected to an account
        API->>API: the account must be ACTIVE; an ADMINISTRATOR with ADMIN_2FA_ENABLED gets the e-mailed code instead
        API-->>UI: the same answer as login: { token, username, role } and the refresh cookie (or 202 for the code)
    else connected to nobody, e-mail verified and used by no account
        API-->>UI: 200 { signupRequired, email, name }: the page asks for a username
        UI->>API: POST /api/auth/google/register { credential, username }
        API-->>UI: 201 { token, username, role } and the refresh cookie (the account now exists)
    else connected to nobody, e-mail used by an account (or none verified)
        API-->>UI: 400 "sign in with your password, then connect Google on your Profile page"
    end
```

- **Signing in** to an account that is connected: the rules of a password sign-in apply. The account must be `ACTIVE` (checked in `AuthService.loginWithGoogle`, because this path does not go through the `AuthenticationManager`), failures (a bad token, an inactive account) count toward the 5-in-15-minutes lock-out under the key `address:google`, and an administrator still enters the e-mailed code (`POST /api/auth/login/verify`) when the second step is on.
- **Creating an account** (`POST /api/auth/google/register`, from the sign-in page or the Create Account page): the e-mail and name come from the verified token, never from the request; the person **chooses the username** (the self-registration rules, unique case-insensitively, a taken one is `400 "Username is already taken"`); the account is `ACTIVE` at once with the role `USER` (Google already verified the mailbox, so no e-mailed code), the Google account is connected to it, and the person is signed in. An e-mail that an account already uses is **never attached**: the person is told to sign in with the password and connect Google on Profile.
- **No password yet.** A Google-created account has `users.password_set = false` and a hash of random bytes (`V24`), so a password sign-in cannot work. Profile shows *Set a password* (`POST /api/users/me/google/password`), confirmed with a fresh Google ID token whose `sub` is the one connected to this account; afterwards the account has a password like any other. Until then `PUT /api/users/me/password` and disconnecting Google are both refused (`400`).
- **Connecting an existing account** is `POST /api/users/me/google { credential, currentPassword }` from the Profile page (`GoogleSignInService.link`): the password is checked **first** (so a stolen access token alone cannot attach someone else's Google account), then the token; one Google account per TaskFlow account and the reverse (`UNIQUE (provider, subject)` and `UNIQUE (user_id, provider)`). **Disconnecting** is `DELETE /api/users/me/google`, allowed whenever the account has a password.
- **Why not match by e-mail:** the e-mail on an account can be edited by its owner without any new verification (`UserService.updateOwnProfile`) and set by an administrator without any, so a match proves nothing about who owns the account.
- **After it** the session is the usual one: the 15-minute JWT in memory and the `taskflow_refresh` cookie.

## 2. Account statuses

`users.account_status` (CHECK constraint in `01-init.sql`):

| Status | How an account gets it | Can log in | Can be invited / assigned | Notes |
|---|---|---|---|---|
| `PENDING_VERIFICATION` | Self-registration, until OTP is verified | No | No (cannot be invited — see [users-and-projects.md](users-and-projects.md#4-invitations)) | Set by `registerSelfServiceUser` |
| `ACTIVE` | OTP verified; or created by an administrator (default) | Yes | Yes | The only status `CustomUserDetailsService` treats as enabled |
| `INACTIVE` | Set by an administrator (`PUT /api/users/{id}`, `POST /api/users`) | No (new logins) | No | An administrator cannot make a user inactive while they are the **sole active owner** of a project (`400`) |
| `SUSPENDED` | Same as `INACTIVE` | No (new logins) | No | Seed data includes one of each: `contractor.felix` (INACTIVE), `exemployee.diego` (SUSPENDED) |

Where the status is enforced:

- **Login** — `CustomUserDetailsService` marks every non-`ACTIVE` account as disabled.
- **Task assignment** — database trigger `trg_task_assignees_not_suspended`.
- **Subtask assignment** — `SubtaskService.applyRequest` (a plain FK column has no trigger).
- **Project invitation and direct add** — `ProjectMemberService.assertEligibleForTeam`.
- **Invitation suggestions** — `UserRepository.findInvitableUsers` returns `ACTIVE` accounts only.
- **Existing sessions** — enforced on every request by `ActiveAccountJwtValidator` (see section 1.1).

## 3. Roles and permissions

Two levels of role, one permission table ([ADR-0015](adr/0015-two-level-roles-system-and-project.md), specified in [assignment-brief.md](../assignment-brief.md) Part B). Implemented by migration `V10__two_level_roles.sql` on 2026-10-08.

| Level | Roles | Stored on | Answers |
|---|---|---|---|
| **System role** | `ADMINISTRATOR`, `PROJECT_MANAGER`, `USER` | the account (`users.role_id`) | what the person may do **anywhere** |
| **Project role** | `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | one membership (`project_members.project_role`) | what the person may do **inside one project** |

A person has exactly one system role and one project role in each project they belong to. There is no single global hierarchy.

| Requirement name | Representation |
|---|---|
| Administrator | system role `ADMINISTRATOR` |
| Project Manager | system role `PROJECT_MANAGER` **and normally** project role `OWNER` on the projects they manage — two different roles: the first lets a person create projects and see cross-project reports; the second gives authority inside one project |
| Team Leader | project role `ADMIN` |
| Team Member | project role `MEMBER` |
| Viewer | project role `VIEWER` (not named in the assignment; kept for read-only participants) |
| everyone else | system role `USER` (the default for every new account) |

The `roles` table holds all seven (`scope` = `SYSTEM` or `PROJECT`; `roles.project_role` names the project role a project row stands for). **Permissions** (`permissions` table): `VIEW`, `CREATE`, `EDIT`, `DELETE`, `ASSIGN`, `APPROVE`, `GENERATE_REPORTS`. **Grants** (`role_permissions`): one row per *(role, permission, resource, scope)*; the 14 resources `PROJECT`, `MILESTONE`, `MEMBER`, `TASK`, `TASK_STATUS`, `SUBTASK`, `COMMENT`, `WORK_LOG`, `ATTACHMENT`, `CHECKLIST_ITEM`, `REPORT`, `USER`, `ROLE`, `LOOKUP`; scope `SYSTEM` (anywhere) or `PROJECT` (inside a project where the user holds that project role).

**Decision chain** (`ProjectAccessGuard` → `PermissionService`): the account must be `ACTIVE` → `ADMINISTRATOR` is allowed everywhere and bypasses membership → a **system-level** action needs the matching system grant → a **project-level** action needs an `ACTIVE` membership and is allowed by the **project role's** grants → ownership/assignment restrictions (section 5.2). **A system role never widens a project role**: it holds only system-scope grants, so a Project Manager who is only a `VIEWER` of a project can only read it. A non-member asking for a project gets `404`; everything else refused is `403` with a message that says what is missing.

**System-scope grants** (everything else is project scope):

| Resource:action | Administrator | Project Manager | User |
|---|---|---|---|
| `PROJECT:CREATE` — create a project | ✅ | ✅ | ❌ |
| `REPORT:GENERATE_REPORTS` — reports across every project the person belongs to | ✅ | ✅ | ❌ |
| `USER:*` — directory, accounts, give a system role | ✅ | ❌ | ❌ |
| `ROLE:*` — see and edit roles and the matrix | ✅ | ❌ | ❌ |
| `LOOKUP:CREATE` — new positions and departments | ✅ | ❌ | ❌ |

A Team Leader or Owner also reaches **Reports** through the project-scope grant `REPORT:GENERATE_REPORTS` (section 5.2); the Reports page and link appear for anyone who holds it at either level, and every `/api/reports/*` endpoint checks it on the server (an Administrator reports on all projects, anyone else on the projects where they hold it).

New accounts (self-registration, or an administrator creating one without choosing a role) are `USER`. An Administrator gives or changes a system role in **Administration → Users** (`PUT /api/users/{id}/role`); `ADMINISTRATOR` is never given at registration. **A person who owns a project cannot be moved to `USER`** until ownership is transferred (only a Project Manager or Administrator can own a project).

Guards: `@PreAuthorize("@permissions.require(authentication,'USER','CREATE')")` (class `security/PermissionChecker`) on user, role, position, department and permission endpoints; `ProjectAccessGuard.assertCan / assertSystemCan` inside services. A refused check throws `AccessDeniedException` → **403** with a specific sentence (`GlobalExceptionHandler`), for example *"Only a Project Manager or an Administrator can create a project"*.

**Editing the matrix:** an Administrator can change the grants of any role except `ADMINISTRATOR` (`PUT /api/roles/{id}/permissions`, which replaces the role's full grant list). `RolePermissionService` rejects unknown resources/permissions/scopes, grants in a scope the role does not have (a system role holds only system grants; a project role only project grants), and removing `PROJECT:VIEW` from a project role (members would be locked out). A system-wide grant (scope `SYSTEM`) is only accepted on projects, reports, users, roles and positions/departments, so a system role never widens a project role (D-02). Built-in roles cannot be renamed or deleted. **The last Administrator cannot be demoted** (`400`). **Extra system roles (D-14, built 2026-10-13):** an Administrator creates, renames and deletes them (`POST` / `PUT` / `DELETE /api/roles`, `RoleService`); a new role is `scope` `SYSTEM`, has no project role, is not built in and holds no grants until the matrix is edited. The name is stored in upper case (`Quality auditor` → `QUALITY_AUDITOR`); a name in use is a `409`; a role that accounts still hold cannot be deleted (`409`); an extra role cannot hold *create projects*, because the creator of a project becomes its owner and only a Project Manager or an Administrator can own one (D-04). Custom *project* roles remain undefined by the specification.

## 4. Password policy

One rule, defined once in `dto/PasswordPolicy.java` and mirrored for the UI in `frontend/src/api/validation.js` (`PASSWORD_PATTERN`, `PASSWORD_RULES`):

- at least **8 characters**
- at least one **uppercase** letter
- at least one **lowercase** letter
- at least one **digit**
- at least one **special** character (anything that is not a letter or digit)

Regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$`. Message: *"Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character"*.

Applied to: self-registration (`RegisterRequest`), changing your own password (`ChangePasswordRequest.newPassword`), administrator account creation (`UserCreateRequest`), administrator password reset (`UserService.updateUser`, only when a password is supplied). **Not** applied to login — an old or seeded password must still work.

UI: Register, Profile → Password, and the administrator's *Add member* dialog show a live checklist (`components/ui/PasswordChecklist.jsx`); a failed client check names the missing rules (`describePasswordProblem`); a backend `fieldErrors` message is surfaced by `passwordErrorMessage`.

Storage: BCrypt (`BCryptPasswordEncoder`, default strength). Passwords are never returned in any response. Changing your own password requires the **current** password (`"Current password is incorrect"`, 400).

There is no password-reset ("forgot password") flow and no password expiry or history.

## 5. Project roles and the permission matrix

Real authority inside a project comes from the caller's **active** `project_members` row (`project_role`). The same person can be Owner of one project and Viewer of another.

| Project role | Business name | How a person gets it |
|---|---|---|
| `OWNER` | Project Manager (of this project) | Automatically for whoever creates the project; afterwards only by **transfer** (below). Never invited or added directly |
| `ADMIN` | Team Leader | Invited with that role, or changed by an Owner (a Team Leader can set Member / Viewer) |
| `MEMBER` | Team Member | Default for accepted invitations and direct adds |
| `VIEWER` | Viewer | Invited with that role or changed later |

A **`PENDING`** or **`DECLINED`** membership grants nothing: every visibility check uses `status = 'ACTIVE'` (`ProjectMemberRepository.findProjectIdsByUserId`, `ProjectAccessGuard.activeRole`).

**A project has exactly one `OWNER`**, and the owner is also the project's manager. Ownership moves in one step (`ProjectOwnership`): making an active member the owner (`PUT /api/project-members/{id}` with role `OWNER`, needs `PROJECT:ASSIGN`: the Owner or an Administrator) demotes the previous owner to `ADMIN` in the same transaction and updates the project's manager. The new owner must be an **active member who can own projects** (`PROJECT_MANAGER` or `ADMINISTRATOR`), otherwise `400 "<name> cannot own a project…"`. The owner's membership cannot be demoted or removed directly (`400 "…Transfer ownership to another member first"`), and nobody can be invited or added *as* the owner (`400 "A project has exactly one owner…"`). The database backs this with the deferred trigger `trg_project_members_single_owner` (checked at commit, skipped when the project itself is being deleted — so a project with a single owner can be deleted). An administrator creating or editing a project can name another manager; that is an ownership transfer with the same eligibility rule.

### 5.1 `ProjectAccessGuard`

| Method | Meaning |
|---|---|
| `isAdmin` | the caller is a system `ADMINISTRATOR` (bypass) |
| `hasAccess` / `assertAccess` | `ADMINISTRATOR`, or an active member with any role — all reads. Throws **404** (`"Project not found"`), not 403, so the existence of a project is not revealed to non-members |
| `activeRole` | the caller's active project role, or none |
| `can(user, projectId, Resource, Action)` / `assertCan` | project-scope grant of the caller's role in that project, or a system-scope grant of their system role, or `ADMINISTRATOR`. `assertCan` throws **403** with a specific message |
| `systemCan(user, Resource, Action)` / `assertSystemCan` | system-scope grants only (create a project, reports, users, roles) |
| `denialMessage` | the sentence used in the 403 |

`ADMINISTRATOR` can do everything in the tables below.

### 5.2 Project-scope matrix

These are the `role_permissions` rows with `scope = PROJECT` seeded by `V10` and `V13` (the whole matrix is 198 rows; the Administrator holds 98 of them, "—" = not granted). `PermissionServiceTest` checks every role × resource × action × scope.

| Resource | Owner (`OWNER`) | Admin / Team Leader (`ADMIN`) | Member / Team Member (`MEMBER`) | Viewer |
|---|---|---|---|---|
| `PROJECT` | View, Edit, Delete, Assign (transfer ownership, name the project lead) | View, Edit | View | View |
| `MILESTONE` | View, Create, Edit, Delete | View, Create, Edit, Delete | View | View |
| `MEMBER` (invite, direct add, change role, remove) | View, Create, Edit, Delete | View, Create, Edit, Delete | View | View |
| `TASK` | View, Create, Edit (every field), Delete, Assign, **Approve** | same | **View only** | View |
| `TASK_STATUS` (status/progress of a task assigned to you) | Edit | Edit | Edit | — |
| `SUBTASK` | View, Create, Edit, Delete | View, Create, Edit, Delete | View, Create, Edit (limited, below) | View |
| `COMMENT` | View, Create, Delete (moderate) | View, Create, Delete | View, Create | View |
| `WORK_LOG` | View, Create, Delete (any entry) | View, Create, Delete | View, Create | View |
| `ATTACHMENT` (files on a task or the project) | View, Create, Delete (any file) | View, Create, Delete | View, Create | View |
| `CHECKLIST_ITEM` | View, Create, Edit, Delete | View, Create, Edit, Delete | View, Create, Edit (limited, below) | View |
| `REPORT` (`GENERATE_REPORTS`) | ✅ for this project | ✅ for this project | — | — |

A Team Leader may delete work items and remove members (never the Owner) but **cannot delete the project, transfer ownership or grant `OWNER`**. Setting a member's project role follows B3.7 / B3.9: nobody changes their own; the Owner and an Administrator set any role; a Team Leader only moves a Team Member between *Team Member* and *Viewer* (`ProjectMemberService.assertMayChangeRole`). Team Tasks and Team Workload need `TASK:ASSIGN` in the project (`TeamViewsService`). A Team Member **does not create tasks**.

Rules the table cannot express (they depend on *who did it*, so they stay in code):

| Rule | Where |
|---|---|
| Edit a comment — author only (nobody else, not even an administrator) | `CommentService` |
| Change a member's project role — never your own; a Team Leader only Team Member ⇄ Viewer and never the Owner or another leader (`403`) | `ProjectMemberService.assertMayChangeRole` |
| See Team Tasks and Team Workload — `TASK:ASSIGN` in the project (`403` for a Team Member) | `TeamViewsService` |
| Delete an attachment — the uploader, or whoever holds `ATTACHMENT:DELETE` | `AttachmentService` |
| A Team Member ticks or renames a **checklist item** only on a task assigned to them (`403 "You can only change the checklist of tasks assigned to you"`); delete — the person who added it, or `CHECKLIST_ITEM:DELETE` | `ChecklistItemService` |
| Delete a comment or a work-log entry — the author, or whoever holds `COMMENT:DELETE` / `WORK_LOG:DELETE` | `CommentService`, `WorkLogService` |
| Change a work-log entry — the author only, and only while they can still log time (`WORK_LOG:CREATE`); not even an administrator | `WorkLogService.updateWorkLog` |
| Change status/progress of a task without `TASK:EDIT` — only if you are a current assignee | `TaskService.updateTask` |
| A Team Member edits a **subtask** only if the task is assigned to them or the subtask is assigned to them (`403 "You can only change subtasks of tasks assigned to you"`); deleting a subtask needs `SUBTASK:DELETE` | `SubtaskService` |
| Accept / decline an invitation — the invited user only | `ProjectMemberService` |
| Change a project's manager — `ADMINISTRATOR` only; it transfers ownership | `ProjectService` → `ProjectOwnership` |
| Read the audit log — `ADMINISTRATOR` only (the Owner reads that project's ownership transfers, D-11) | `AuditLogService` |
| The owner cannot be demoted or removed; ownership is transferred, and only to a Project Manager or Administrator | `ProjectMemberService`, `ProjectOwnership` |
| The last Administrator cannot be demoted; a person who owns a project cannot be moved to `USER` | `UserService` |

**Verified live on 2026-10-08** (after migration `V10`): a `USER` creating a project → `403` *"Only a Project Manager or an Administrator can create a project"*; a Project Manager → `201` and becomes the only Owner; a second Owner invite → `400 "…exactly one owner…"`; a plain `USER` made owner → `400 "…cannot own a project…"`; a Project Manager made owner → `200`, the previous owner became `ADMIN` and the manager changed; the former owner deleting the project → `403`; the new owner deleting a single-owner project → `204`; a Team Member creating a task → `403`; a Team Member editing a subtask of an unassigned task → `403`; a Team Leader removing a member → `204`; a Team Member setting a task Completed → `403` with the approval message, a Team Leader → `200`; a non-member reading a project → `404`; a Team Leader reading the matrix or assigning a role → `403`; editing the Administrator role → refused; demoting the only Administrator → `400`; a self-registered account is `USER` and cannot create a project. Covered by `e2e/roles-permissions.spec.js`, `e2e/permissions.spec.js`, `PermissionServiceTest` (every role × resource × action in `V10`), `ProjectOwnershipTest`, `ProjectMemberServiceTest`, `ProjectServiceTest`, `ViewerWriteAccessTest`, `ProjectAccessGuardTest`, `RolePermissionServiceTest`, `UserRoleServiceTest`, `TaskServiceTest`.

A `VIEWER` is **read-only**: it cannot create, edit or delete tasks, subtasks, comments or time entries, nor change a task it was assigned to. The task panel hides those controls.

### 5.3 Task update rule (row-level)

`PUT /api/tasks/{id}` (`TaskService.updateTask`):

1. **Completing** — if the request moves the task to `COMPLETED` (and it was not already), the caller needs `TASK:APPROVE` in that project (`403 "Only a Project Manager or Team Leader can approve a task as completed. Move it to In Review so it can be approved"`), must also be allowed to decide *this* task (below), and the task must have no open subtasks (`400 "Complete all subtasks before marking this task as done."`). The completion is recorded as the caller's approval. Moving a task into `IN_REVIEW` opens an approval request; moving it out of review withdraws the open one.
2. With `TASK:EDIT` → every field is applied. **If the request changes `projectId`, the caller must also be allowed to edit tasks in the *target* project** (`403` otherwise).
3. Without it, the caller needs `TASK_STATUS:EDIT` **and** must be a current assignee (`403 "You are not assigned to this task"`); then **only `status` and `progress`** are applied — every other field, including `projectId`, is silently ignored.

The database dependency/subtask/date triggers apply regardless of role.

**Approval rules** (`TaskApprovalService.whyNotAllowedToDecide`, assignment-brief.md B3.8 and D-05). Whoever completes or decides a task needs `TASK:APPROVE` in its project (Administrator; Project Manager through the Owner or Team Leader role) and, besides:

| Rule | Exception |
|---|---|
| When the task names an approver, only that person decides | the project `OWNER` and an `ADMINISTRATOR` |
| Nobody decides their own work: the person who asked for the review, or anyone assigned to the task | the project `OWNER` and an `ADMINISTRATOR` |
| Designating the approver needs `TASK:ASSIGN`; the person named must be an active member who holds `TASK:APPROVE` | — |

**Approval flow in the UI:** a Team Member (or anyone who may edit the task) presses *Submit for review* in the task panel, or takes the task *In Progress → In Review* with the quick-advance circle. An approver then decides in the panel (*Approve*, *Request changes*, *Reject*, each with a comment) or from the *Awaiting your approval* list on the Tasks page. The Completed option and "Mark as Completed" are hidden from people who may not decide that task, including an approver who works on it themselves (they submit it for review instead).

## 6. System-level user management

| Action | Who | Where |
|---|---|---|
| Create, update, delete any user | `USER:CREATE/EDIT/DELETE` (Administrator) | `UserController`; UI: *Add member* creates an account with a temporary password and an optional system role (default `USER`); *Administration → Users* edits an account, changes its status and deletes it (never the last Administrator, the sole owner of a project or your own account) |
| Give an account a system role | `USER:ASSIGN` (Administrator) | `PUT /api/users/{id}/role`; UI: *Administration → Users*. Refused for the project-only roles, for demoting the last Administrator, and for moving a person who owns a project to `USER` |
| List users | everyone, **scoped**: an administrator sees all; others see themselves plus people who share an active project with them | `UserService.getAllUsers` |
| Look up one user by id or username | **scoped** — an administrator, the user themself, or someone who shares an active project with them; anyone else gets `404` | `UserService.assertCanView` |
| Edit own profile, password, photo, preferences | the user themself (target comes from the token, not the URL) | `/api/users/me*` |
| See the caller's own permissions | the user themself | `GET /api/users/me/permissions` |
| Set your own position/department | any signed-in user, choosing from the managed lists (new list entries need `LOOKUP:CREATE`) | `UserService.updateOwnProfile` (`PUT /api/users/me`) |
| Set another user's position/department | `ADMINISTRATOR`, or someone with `MEMBER:EDIT` in a project the target is also an active member of; **never yourself** | `UserService.updateMemberPositionDepartment` |
| Create positions / departments | `LOOKUP:CREATE` (Administrator) | `PositionController`, `DepartmentController` |
| See / edit roles and the matrix | `ROLE:VIEW` / `ROLE:EDIT` (Administrator) | `RoleController`, `PermissionController`; UI: *Administration → Roles & Permissions* |

Any account — including an administrator's — cannot be set to `INACTIVE`/`SUSPENDED` or deleted while it is the sole active owner of a project (`400`, `UserService.assertNotSoleOwnerOfAnyProject`). The last Administrator cannot be demoted.

## 7. Frontend authorization

- `auth/AuthContext.jsx` holds `token`, `username`, `role`, `profile`, `permissions`, `loading`. On load it reads who was signed in from `localStorage` (never the token), renews the access token from the refresh cookie, fetches the profile and `GET /api/users/me/permissions`; if that fails it logs out. It exposes `can(resource, action, projectId)`, `canSys(resource, action)`, `canAny(resource, action)`, `isAdministrator` and `refreshProfile()` (called after the user's own role or the matrix changes).
- `auth/ProtectedRoute.jsx` redirects unauthenticated visitors to `/login`; `auth/RequirePermission.jsx` shows the 403 error page (`pages/ErrorPage.jsx`) for a route the role may not open (Reports, Administration).
- `api/permissions.js` turns the server's `RESOURCE:ACTION` list into those helpers. **It contains no role names or rules** — what the server says is what the UI shows. It is advisory: the server checks every request.
- Controls the user cannot use are **hidden, not disabled** (task edit/delete, status choices, "New Project", the Reports and Administration links, comment box, subtask and time controls, invite role picker).
