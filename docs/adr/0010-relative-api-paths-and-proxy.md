# ADR-0010: Relative `/api` paths behind a proxy

- **Status:** Accepted
- **Date:** 2026-09-08 (`c2a0209` introduced `frontend/nginx.conf`; the Vite proxy mirrors it)
- **Area:** infrastructure / frontend

## Context

The React app must reach the Spring API in three setups: the Docker stack, local development with `npm run dev`, and any future deployment. Hard-coding an absolute backend URL would need per-environment configuration and CORS.

## Decision

The frontend calls only **relative `/api/...` paths**. A reverse proxy forwards them to the backend:

- **Docker:** nginx in the `frontend` container (`proxy_pass http://backend:8080/api/;`, plus an SPA fallback to `index.html`).
- **`npm run dev`:** Vite's dev server proxy (`/api` → `http://localhost:8080`, `vite.config.js`).

No frontend environment variable holds an API base URL.

## Why (as stated in the project)

`README.md` — *Key Design Decisions* #8: nginx already proxies `/api/`, and a matching Vite proxy "makes the same code work under `npm run dev`"; no API base URL variable is needed, and no CORS round-trip is required in either environment.

## Alternatives considered

- **Absolute API URL via `VITE_*` variable** — avoided (stated).
- **Serving the frontend from Spring Boot** — not done *(inferred)*; separate containers were chosen.

## Consequences

- Same-origin requests in both environments; `app.cors.allowed-origins` stays as a fallback for direct cross-origin calls.
- Any new deployment must provide an equivalent proxy (nginx config, ingress rule…). The deployment target is **Unknown**.
- Behind nginx the backend sees the proxy as the client address; combined with `getRemoteAddr()` in the login limiter this probably weakens per-client rate limiting (issue I-09, needs verification).
- The Docker frontend and `npm run dev` both want port 5173, and the backend container and local backend both want 8080 — stop one before starting the other ([../setup.md](../setup.md#7-troubleshooting)).

## Evidence

`frontend/nginx.conf`, `frontend/vite.config.js`, `frontend/src/api/client.js`, `docker-compose.yml`.
