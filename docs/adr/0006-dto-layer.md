# ADR-0006: DTOs on every endpoint, never entities

- **Status:** Accepted
- **Date:** 2026-09-09 (`27c9aca` "Fix backend security gaps: RBAC, DTOs, password hashing, CORS, validation")
- **Area:** api

## Context

The first controllers returned JPA entities directly. Entities carry fields that must never leave the server (the password hash) and nested associations (a project's `manager`, a member's `user`) that would drag them along.

## Decision

Every controller accepts a **request DTO** (validated with Bean Validation) and returns a **response DTO**. Nested objects are DTOs too (`ProjectResponse.manager` is a `UserResponse`, which has no password field). Entities stay inside the service layer; services map to DTOs, including computed fields (`TaskResponse.overdue`, `blocked`, subtask counts).

Files: `backend/src/main/java/backend/dto/`.

## Why (as stated in the project)

`README.md` — *Key Design Decisions* #3: "prevents leaking fields like `passwordHash` through nested associations, and decouples the API shape from the JPA entity graph."

## Alternatives considered

- **`@JsonIgnore` on entity fields** — not chosen *(inferred)*: it ties the API shape to the persistence model and is easy to miss on a new association.
- **One shared model for request and response** — not chosen: requests have write-only and validation-only fields (`password`, `confirmPassword`), responses have computed ones.

## Consequences

- `UserServiceTest` asserts that responses do not leak the hash.
- More classes to maintain (41 classes in the `dto` package — requests, responses and `PasswordPolicy`) and manual mapping code; response DTOs for list endpoints can nest large objects (for example `TaskAssigneeResponse` embeds a full `TaskResponse`).
- Nested `UserResponse` exposes email, phone and date of birth wherever a user appears (for example a project's manager) to every project member; a narrower public-profile DTO does not exist, except `InvitableUserResponse`, which was introduced deliberately narrow on 2026-10-06.
- Updates are full-replace (`PUT`) because request DTOs mirror the whole resource; clients re-send everything (`taskResponseToRequest`).

## Evidence

`dto/` package, `UserServiceTest`, `README.md` Key Design Decisions #3, `InvitableUserResponse`.
