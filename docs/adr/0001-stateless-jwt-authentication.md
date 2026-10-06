# ADR-0001: Stateless JWT authentication

- **Status:** Accepted
- **Date:** 2026-09-08 (`d3a49b5` "add authentication and JWT login")
- **Area:** authentication

## Context

The frontend (React) and backend (Spring Boot) are separate deployables reached through an nginx proxy. The API needed a way to identify the caller on every request and carry the caller's system role.

## Decision

Log in with `POST /api/auth/login` and receive a signed **JWT** (HS512, `sub` = username, optional custom `role` claim, 1 hour by default). Every other request sends `Authorization: Bearer <token>`. The server keeps **no session**: Spring Security's OAuth2 resource server validates the signature and expiry, and a custom `JwtAuthenticationConverter` maps the `role` claim to `ROLE_<name>` authorities. Services identify the caller from `authentication.getName()`.

Files: `config/SecurityConfig.java`, `service/JwtService.java`, `service/AuthService.java`, `frontend/src/api/client.js`, `frontend/src/auth/AuthContext.jsx`.

## Why (as stated in the project)

`README.md` — *Key Design Decisions* #1: stateless JWT over sessions; the token carries the role as a custom claim, and a custom converter is needed because Spring's default converter only reads OAuth2 `scope` claims (`SecurityConfig` comment: without it every token would decode with zero authorities and every `@PreAuthorize` would fail).

## Alternatives considered

- **Server-side sessions / cookies** — rejected in favour of statelessness (stated). CSRF protection is consequently disabled in `SecurityConfig` because the credential is a header, not a cookie (inferred from the configuration).
- **Spring's default scope-based JWT mapping** — not usable with the custom `role` claim (stated).
- **Refresh tokens** — *not* implemented; listed as future work in the READMEs.

## Consequences

- No server state to share between instances for authentication itself.
- **Deactivation takes effect immediately (changed 2026-10-06):** every request checks the account is still `ACTIVE` while the JWT is decoded (`ActiveAccountJwtValidator`, one small query per request), so a suspended account's token is rejected with `401` — previously it worked until it expired (verified live, issue F-17). There is still **no revocation for an active account** (no forced logout, no token blacklist) and logout is client-side only.
- Tokens live in `localStorage` (readable by any script on the page).
- A 1-hour lifetime means users must log in again; there is no refresh flow.
- The signing secret is configuration (`JWT_SECRET`); a startup warning (`JwtSecretGuard`) fires if the development default is used.
- A user with no global role gets a token **without** a `role` claim and therefore zero authorities; all project authority is checked separately ([ADR-0002](0002-project-level-authorization.md)).

## Evidence

Commits `d3a49b5`, `062034f`; `SecurityConfig`, `JwtService`; e2e `auth.spec.js`; [../authentication-authorization.md](../authentication-authorization.md).
