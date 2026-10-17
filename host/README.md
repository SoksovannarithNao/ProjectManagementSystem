# Hosting: Vercel (frontend) + Render (backend) + Neon (database)

Order matters: database first, then backend, then the frontend rewrite. Run the commands from the
repository root in PowerShell. Never paste a connection string or password into a chat or commit it.

The frontend calls relative `/api/...` paths (nginx forwards them locally), so on Vercel a rewrite
must send `/api/*` to Render (step 3). Because the browser then only ever talks to the Vercel
domain, the refresh cookie (`SameSite=Strict`) and CORS keep working.

## 1. Neon (database)

1. Create a Neon project. Pick Postgres 17 (what these scripts were tested on) or newer, and note
   the database name (default `neondb`).
2. In the connection details, **turn off "Pooled connection"** and copy the connection string. It
   looks like `postgresql://owner:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`.
   A password with special characters must be URL-encoded in that string.
3. Choose a long password for the backend's database role (called `APP_PW` below).
4. Load the schema, the demo data, the Flyway baseline and the app role, in this order. Docker
   supplies `psql`:

```powershell
$env:NEON_URL = 'postgresql://owner:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require'
$env:APP_PW   = 'a-long-random-password'
$env:APP_DB   = 'neondb'   # the database name in the URL

docker run --rm -e NEON_URL -e APP_PW -e APP_DB `
  -v "${PWD}\database\init:/init:ro" -v "${PWD}\host:/host:ro" postgres:17-alpine sh -c '
  set -e
  for f in 01-init.sql 02-seed.sql 04-flyway-baseline.sql; do
    echo "== $f"; psql "$NEON_URL" -v ON_ERROR_STOP=1 -q -f /init/$f
  done
  echo "== app role"
  psql "$NEON_URL" -v ON_ERROR_STOP=1 -q -v app_password="$APP_PW" -v app_db="$APP_DB" -f /host/neon-app-role.sql'
```

Run it **once**, on an empty database. `01-init.sql` is not safe to run twice. To start over, drop
and recreate the database in Neon first.

Later schema changes: `database/taskmanager/migrations` holds V1 to V21 (already inside
`01-init.sql`; the baseline row makes Flyway skip them). Apply any newer `V22+` file with the Flyway
container against the same direct URL.

**Done for this project (2026-10-17).** Neon project `morning-rain-38425215`, branch `production`,
database `neondb` (Postgres 18) was loaded with the steps above using the Neon CLI (`neon`, signed in
with `neon login`). The generated `taskmanager_app` password and the JDBC URL are in `host/.env.local`
(git-ignored by the `*.local` rule). Copy the values from that file into Render; do not commit it.

## 2. Render (backend)

1. New → Web Service → connect the GitHub repo. Runtime **Docker**, root directory `backend`
   (it uses `backend/Dockerfile`). Health check path `/api/health`.
2. Environment variables:

| Name | Value |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://ep-xxxx.region.aws.neon.tech/neondb?sslmode=require` (host and database from Neon, **no** user or password in it) |
| `SPRING_DATASOURCE_USERNAME` | `taskmanager_app` |
| `SPRING_DATASOURCE_PASSWORD` | the `APP_PW` you chose |
| `JWT_SECRET` | a long random string (64+ characters) |
| `REFRESH_COOKIE_SECURE` | `true` |
| `CORS_ALLOWED_ORIGINS` | `https://project-management-system-lemon-chi.vercel.app` |
| `JAVA_TOOL_OPTIONS` | `-Xmx300m` (a 512 MB instance is tight for Spring Boot) |
| `MAIL_*` | only needed for sign-up codes; see the caution below |

3. Deploy, then open `https://<your-service>.onrender.com/api/health`. It should answer.

## 3. Vercel (frontend)

`frontend/vercel.json` holds the rewrites (Render URL `https://projectmanagementsystem-1yh5.onrender.com`).
Commit it and let Vercel redeploy. In the Vercel project settings the root directory must be
`frontend`. If the Render service name or URL ever changes, edit the destination:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-SERVICE.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The first rewrite forwards the API. The second makes `/login`, `/projects` and a page refresh load
the app instead of a 404. Real files (JS, CSS, images) are still served first.

## 4. Check it

- `https://<vercel-url>/api/health` answers (through the rewrite).
- Sign in at the Vercel URL with `admin.system` (the demo password is in the repository README).

## Cautions

- **The demo accounts share a password that is public in this repository.** The site is on the open
  internet, so change the administrator's password right after the first sign-in and think about
  what the other demo accounts can see.
- **Free-tier sleep.** Render stops an idle free service, so the first request afterwards can take
  30 to 60 seconds, and Neon pauses an idle database for a moment too.
- **Sign-up codes (email).** Render's free tier may block outbound SMTP. Login does not depend on
  email; self-registration does. Test it, or leave registration for later.
- **Rate limiter.** The failed-login limiter keys on the client address; check after deploying that
  one user's failed attempts do not lock out everyone.
