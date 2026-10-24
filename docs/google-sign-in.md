# Sign in with Google

An optional way to sign in and to create an account, next to the username (or e-mail) and password. A Google account is known by its stable id (`sub`), **never by e-mail address**, because the e-mail on an account can be edited without being verified. The reasoning is in [ADR-0017](adr/0017-link-only-google-sign-in.md) (connecting an existing account) and [ADR-0018](adr/0018-google-sign-up-and-first-password.md) (creating one); the endpoints are in [api-reference.md](api-reference.md#3-auth) (section 3 and the `/api/users/me/google` rows of section 4).

## How a person uses it

**With an existing account** (the first time, once):
1. Sign in with the password, open **Profile**, find **Sign in with Google**.
2. Type the current password (it proves the account is theirs), then choose the Google account in Google's button. The card then says *Connected to name@gmail.com*.
3. From then on the **Continue with Google** button on the sign-in page signs in that account, with the same session as a password sign-in. **Disconnect** on the same card removes the link; the password never stopped working.

**With no account yet** (the sign-in page or the Create Account page):
1. Press **Continue with Google** (or **Sign up with Google**) and choose the Google account.
2. Choose a **username** (3 to 50 letters, digits, dots, underscores or hyphens; it cannot be changed later, and a name that is already taken is refused, in any letter case). The e-mail address and the name come from Google.
3. The account is created (role `USER`, active at once, because Google already verified the e-mail) and the person is signed in.
4. That account has **no password yet**. Profile shows **Set a password** instead of the Password card: choose a password and confirm it by choosing the Google account again. After that the account also signs in with its username or e-mail and the password. Until then the Google connection cannot be removed, or there would be no way to sign in.

**If an account already uses the Google account's e-mail**, Google does not create or attach anything: the person is told to sign in with the password and connect Google on Profile. An **administrator** who signs in with Google still gets the e-mailed 6-digit code when `ADMIN_2FA_ENABLED=true`, exactly as after a password ([ADR-0016](adr/0016-admin-two-factor-and-https-mail.md)). A suspended or deactivated account is refused.

## What the server checks

`GoogleTokenVerifier` verifies the ID token Google gave the browser: the signature against Google's public keys, that it has not expired, that it was issued by `https://accounts.google.com` (or `accounts.google.com`), and that its **audience is this app's client ID** (a token Google made for another app is refused). It then looks the account up by Google's `sub`. Failures count toward the sign-in lock-out (5 in 15 minutes per address, key `address:google`); a taken username does not. What is kept: in `user_identities` ([database.md](database.md)) Google's `sub` and, when Google vouches for it (`email_verified`), the e-mail; for an account Google creates, the Google name becomes the full name (it can be edited on Profile). The picture in the token is not read.

## Turning it on

The feature is off until the backend has a client ID: **`GOOGLE_CLIENT_ID`** (a public value, there is no client secret). Blank means no button and every Google endpoint answers `404`; `GET /api/auth/google/config` returns `{ "clientId": null }`. Migrations `V23` (`user_identities`) and `V24` (`users.password_set`) must be applied first.

### Google Cloud Console (manual, once)

Do this in a Google Cloud project of its own if you can: the project that sends the one-time codes through the Gmail API asks for the sensitive `gmail.send` scope, and keeping sign-in apart avoids tying the two consent screens together ([google-oauth-verification.md](google-oauth-verification.md)).

1. **Google Auth Platform (OAuth consent screen):** *External*, app name **TaskFlow**, user-support and developer e-mail, the home page, privacy policy and terms URLs from [google-oauth-verification.md](google-oauth-verification.md), authorised domain `task-flow.lat`. Scopes: only `openid`, `email`, `profile` (these need no Google verification, as far as Google's documentation says; not exercised here). Publish the app (*In production*), or only the test users you list can sign in.
2. **Credentials > Create credentials > OAuth client ID**, type **Web application**.
3. **Authorized JavaScript origins** (this box, **not** *Authorized redirect URIs*), exact, no path, no wildcard:
   - `https://www.task-flow.lat` (production)
   - `http://localhost:5173` (the Docker frontend and `npm run dev`) and, if you use port 80 locally, `http://localhost`
4. **Authorized redirect URIs:** none (the ID-token flow has no redirect).
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`; the client secret is not needed).

A new origin can take from a few minutes to a few hours to be accepted; until then Google shows `origin_mismatch` or "no registered origin".

### Where to put the client ID

| Where | How |
|---|---|
| Local Docker | `GOOGLE_CLIENT_ID=...` in the root `.env`, then `docker compose up -d backend` (the frontend needs no rebuild: it asks `GET /api/auth/google/config`) |
| Render (backend) | environment variable `GOOGLE_CLIENT_ID`, then redeploy ([../host/README.md](../host/README.md) section 2) |
| Neon (database) | migrations `V23` and `V24` must be applied first ([../host/README.md](../host/README.md) section 1) |

The Vercel project needs nothing: the frontend learns the ID from the backend.

### Check

`GET /api/auth/google/config` answers the client ID; the sign-in and Create Account pages show Google's button under *or*; Profile shows the **Sign in with Google** card.

### Rolling back

Blank `GOOGLE_CLIENT_ID` and restart the backend: the buttons and the Profile card disappear and the Google endpoints refuse, while every password sign-in is untouched. The tables and the column can stay (they are additive). **Accounts that Google created and that have not set a password cannot sign in while it is off**; an administrator restores them by resetting the password (Administration → Users → Edit), which also marks the account as having one. Accounts that were connected from Profile keep their password and are unaffected.

## Known limitations

- Connecting an existing account needs its password, so a person who forgot it (there is no forgot-password flow) cannot connect Google until an administrator resets it.
- Someone who edits their own profile e-mail to another person's address stops that person from creating an account with Google (they are told to sign in and connect); nothing is captured.
- No `nonce` is sent or checked; connecting and disconnecting are not in the audit log (creating an account is, as `ACCOUNT_CREATED`) ([ADR-0017](adr/0017-link-only-google-sign-in.md), [ADR-0018](adr/0018-google-sign-up-and-first-password.md)).
- Google's script and button are loaded from Google; the privacy policy says so ([pages_docs/privacy-policy.md](pages_docs/privacy-policy.md)).
- A real sign-in cannot run in the automated tests (a real Google account is needed). They cover the token verification, the rules, the endpoints, and the feature being off, and the screens with Google's script stubbed ([testing.md](testing.md)). By hand on 2026-10-24, connecting a real Google account, signing in with it, and creating an account from a second real Google account all worked; setting a password on that new account with Google is not yet confirmed ([test-cases.md](test-cases.md), MAN-08 and MAN-09).
