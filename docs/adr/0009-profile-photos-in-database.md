# ADR-0009: Profile photos stored in the database, served by random token

- **Status:** Accepted
- **Date:** 2026-09-14 (`35c6daf`, migration `V6`)
- **Area:** database / api

## Context

Users upload a profile photo. The frontend displays it with a plain `<img>` tag, which **cannot send the `Authorization` header** the rest of the API requires.

## Decision

- The image **bytes** are stored in `users.profile_photo` (`BYTEA`) with `profile_photo_content_type`; only JPEG, PNG, WEBP and GIF are accepted, max 5 MB.
- The photo is served by `GET /api/photos/{token}` — **public, no authentication** — where `token` is a random UUID in `users.profile_photo_token`, **regenerated on every upload**. The user id is never part of the URL.
- `UserResponse.profilePhotoUrl` is computed as `/api/photos/<token>` (or null).

## Why (as stated in the project)

`UserService` and `PhotoController` comments: storing in the database means the photo "travels with a `pg_dump`/restore or a managed-Postgres migration instead of being left behind on whichever host originally received the upload"; keying by token rather than id means photos are **not enumerable**; regenerating the token on re-upload "replaces the old public URL (so nothing can serve a stale cached copy)".

## Alternatives considered

- **Files on local disk / object storage** — avoided for the portability reason above (stated). The earlier design stored a URL (`profile_photo_url`), dropped by `V6`.
- **Stable per-user URL or id-keyed URL** — avoided: enumerable and cache-staleness-prone (stated).
- **Authenticated photo endpoint** — not possible with a bare `<img>` tag without extra client work *(inferred)*.

## Consequences

- Anyone who learns a token can fetch that photo without logging in; tokens are unguessable but not secret once shared.
- Photo bytes live in the `users` row: backups grow, and because `User.profilePhoto` is a plain `@Column` `byte[]` (no `@Basic(fetch = LAZY)`), **every load of a `User` entity reads the photo bytes (up to 5 MB)** — including users nested in members, assignees and projects (by code reading; not measured).
- The content type is taken from the client's upload header; the bytes are not inspected (see [../security.md](../security.md#5-input-validation)).
- No automated test covers upload or serving.

## Evidence

`UserService.uploadOwnProfilePhoto/getProfilePhotoByToken`, `PhotoController`, `SecurityConfig` (public `GET /api/photos/**`), `V6__store_profile_photo_in_database.sql`.
