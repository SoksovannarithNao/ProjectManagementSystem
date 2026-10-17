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

Later schema changes: `database/taskmanager/migrations` holds V1 to V22. `01-init.sql` already
contains them and its baseline row (22) makes Flyway skip them on a database loaded from these scripts.
The Neon database of this project was loaded earlier, at baseline 21, so **V22 (the `LOGIN_2FA` code
purpose) still has to be applied to it**, and any later `V23+` file is applied the same way, with the
Flyway container against the owner's direct connection (set `FLYWAY_URL` to
`jdbc:postgresql://<neon-host>/neondb?sslmode=require`, and `FLYWAY_USER` / `FLYWAY_PASSWORD` to the
`neondb_owner` credentials):

```powershell
docker run --rm -e FLYWAY_URL -e FLYWAY_USER -e FLYWAY_PASSWORD `
  -v "${PWD}\database\taskmanager\migrations:/flyway/sql:ro" flyway/flyway:11 `
  -locations=filesystem:/flyway/sql migrate
```

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
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `MAIL_FROM`, `MAIL_FROM_NAME` | only for e-mailed codes (sign-up, administrator sign-in); see section 5 |
| `ADMIN_2FA_ENABLED` | leave unset (`false`) until section 5 is done |

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

## 5. E-mailed codes and the administrator sign-in code (Gmail API)

Render's free tier cannot use SMTP, so the backend sends through the **Gmail API over HTTPS** when
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN` are all set. The same route serves
sign-up codes and the administrator's sign-in code
([ADR-0016](../docs/adr/0016-admin-two-factor-and-https-mail.md)). It sends from your own Gmail account.
Do the Google part once, in this order (the console wording changes now and then):

**A. Google Cloud (free, no billing needed)**
1. Open https://console.cloud.google.com, create a project (for example `TaskFlow`).
2. *APIs & Services > Library*: search **Gmail API** and click *Enable*.
3. *OAuth consent screen* (now *Google Auth Platform*): choose **External**, give an app name and your
   e-mail as support/contact address, and add your Gmail under *Test users*.
4. **Publish the app** (*Audience > Publish app*, status *In production*). Do this **before** step 6:
   a token made while the app is in *Testing* stops working after 7 days. Because the app is not
   verified by Google, the consent screen later shows a warning; that is expected for your own app
   (*Advanced > Go to ... (unsafe)*). The only scope used is `gmail.send`.
5. *Credentials > Create credentials > OAuth client ID*, type **Web application**, and add the
   authorised redirect URI `https://developers.google.com/oauthplayground`. Copy the **Client ID** and
   **Client secret**.

**B. Get the refresh token (OAuth Playground)**
6. Open https://developers.google.com/oauthplayground, click the gear icon, tick **Use your own OAuth
   credentials** and paste the Client ID and secret. In step 1 type the scope
   `https://www.googleapis.com/auth/gmail.send`, click *Authorize APIs*, sign in with the Gmail account
   that will send the mail and allow it. In step 2 click *Exchange authorization code for tokens* and copy
   the **Refresh token**. Keep it like a password.

**C. Render**
7. Add: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (the three values above),
   `MAIL_FROM` = **that same Gmail address**, `MAIL_FROM_NAME` = `TaskFlow`. Redeploy.

**D. Check, then turn the administrator step on**
8. Sign in as `admin.system`, open Administration > Users > Edit on that account and change its
   **e-mail to your real address** (the demo one, `admin.system@taskflow.dev`, is not a mailbox).
   Change the password in the same step.
9. Test that mail arrives: on the sign-up page register a throw-away account with
   `yourname+test@gmail.com` (that goes to your own inbox) and check the code arrives; check the spam
   folder too. An unverified sign-up is deleted automatically after 24 hours.
10. Only then add `ADMIN_2FA_ENABLED` = `true` on Render and redeploy. From now on the administrator
    enters a 6-digit code e-mailed to the address in step 8 after the password.

If the code never arrives and you are locked out, set `ADMIN_2FA_ENABLED` back to `false` (or delete
it) and redeploy. Keep a second administrator account with a working address when you switch it on.

**If sending stops later:** changing the Gmail account's password, or removing the app under your Google
account's *Security > Third-party access*, revokes the refresh token. Sends then fail with a 503 until you
repeat step 6 and update `GMAIL_REFRESH_TOKEN`.

The Neon database needs migration V22 (the `LOGIN_2FA` code purpose) before the administrator step is
switched on; the Flyway container in section 1 applies it (`migrate`).

## Cautions

- **The demo accounts share a password that is public in this repository.** The site is on the open
  internet, so change the administrator's password right after the first sign-in and think about
  what the other demo accounts can see.
- **Free-tier sleep.** Render stops an idle free service, so the first request afterwards can take
  30 to 60 seconds, and Neon pauses an idle database for a moment too.
- **E-mailed codes.** Render's free tier blocks outbound SMTP (ports 25, 465, 587), so Gmail over
  SMTP cannot work there. Section 5 sends through the Gmail API over HTTPS instead. Until it is done, sign-up codes do not
  arrive; plain login does not need e-mail.
- **Rate limiter.** The failed-login limiter keys on the client address; check after deploying that
  one user's failed attempts do not lock out everyone.
