# Google OAuth consent screen: public pages and manual steps

Google asks for a public home page, a privacy policy and terms of service when an OAuth app uses a sensitive scope in production. This page lists what the code now provides and what only you can do in Google Cloud Console and at the domain. **The pages being live does not mean the app is verified**: verification is Google's decision.

## What TaskFlow uses Google OAuth for

TaskFlow's **"Sign in with Google" is optional** (since 2026-10-24, [ADR-0017](adr/0017-link-only-google-sign-in.md), [ADR-0018](adr/0018-google-sign-up-and-first-password.md), [google-sign-in.md](google-sign-in.md)): it signs in an account that was connected to a Google account from its Profile page, or creates one for a person who has none, never matching by e-mail, and asks Google for the basic sign-in scopes `openid`, `email` and `profile` only, which are not sensitive. That is a separate OAuth client from the one below, and best a separate Google Cloud project, so the consent screen of the Gmail sender (a sensitive scope) is not tied to it. The rest of this page is about the other use, which is the reason for the public pages: users otherwise sign in with a username (or e-mail) and a password, and Google OAuth is used for one thing: the operator authorised the backend once, with their own Gmail account, for the scope `https://www.googleapis.com/auth/gmail.send`, so that the backend can send one-time codes by e-mail over the Gmail API (`MailService`, see [ADR-0016](adr/0016-admin-two-factor-and-https-mail.md) and [../host/README.md](../host/README.md) section 5). The scope only sends mail: nothing is read from any mailbox and no user's Google data is received. The privacy policy says exactly this.

## The three URLs (use these exactly)

| Field in the consent screen | URL | Served by |
|---|---|---|
| Application home page | `https://www.task-flow.lat/` | [Landing.jsx](../frontend/src/pages/Landing.jsx), shown at `/` to a signed-out visitor (a signed-in person gets the dashboard) |
| Application privacy policy link | `https://www.task-flow.lat/privacy-policy` | [PrivacyPolicy.jsx](../frontend/src/pages/PrivacyPolicy.jsx) |
| Application terms of service link | `https://www.task-flow.lat/terms-of-service` | [TermsOfService.jsx](../frontend/src/pages/TermsOfService.jsx) |

All three need no sign-in, load from a direct address and after a refresh (Vercel's `rewrites` in [../frontend/vercel.json](../frontend/vercel.json) send every other path to `index.html`; nginx's `try_files` does the same in Docker), carry links to each other, and follow the light, dark and system themes. The home page, the sign-in page and the register page link to the policy and the terms. `index.html` also has a `<noscript>` block with the app name and the two links for crawlers that do not run scripts.

The facts the pages print (operator name, contact e-mail, dates) are in one file, [../frontend/src/config/site.js](../frontend/src/config/site.js).

## Manual steps in Google Cloud Console

1. **Branding / OAuth consent screen:** app name **TaskFlow** (it must match the name on the home page), the three URLs above, a user-support e-mail and a developer contact e-mail you can read.
2. **Authorized domains:** add `task-flow.lat` (the registrable domain, without `www`).
3. **Verify the domain in Google Search Console** with the same Google account that owns the Cloud project: add `task-flow.lat` as a *Domain* property and create the DNS TXT record it gives you, where the DNS for the domain is managed (the registrar, or Vercel DNS). Google refuses a home page, policy or terms URL on a domain the account has not verified.
4. **Data access / scopes:** `https://www.googleapis.com/auth/gmail.send` only. If Google asks why: *TaskFlow sends one-time verification and sign-in codes by e-mail from the operator's own Gmail account. The scope is used only to send; no mailbox data is read.*
5. **Publishing status:** *In production* (a token made while the app is in *Testing* stops working after 7 days).
6. **Verification:** *Publish app* then *Prepare for verification*. For a sensitive scope Google normally also asks for a short demo video (an unlisted YouTube link) that shows the consent flow and what the scope is used for, and may ask follow-up questions. Follow the checklist that the *Verification Center* shows, because Google's requirements change.

If only your own account ever grants the permission, the app can stay unverified and Google only shows an "unverified app" screen during that one grant (and caps the app at 100 grants). Whether you need verification at all is your choice; this is not a promise about Google's rules.

## Check after deploying (production)

`https://www.task-flow.lat/`, `/privacy-policy` and `/terms-of-service` each answer 200 with their own content when opened in a private window, and after a refresh; the apex `https://task-flow.lat/` redirects to `www` (already the case). The e2e spec `frontend/e2e/public-pages.spec.js` checks the same against any running stack (`E2E_BASE_URL`).

## Keep these in step

- If the Gmail route is switched off or replaced, change section 5 of the privacy policy (service providers) and section 6 (Google) at the same time.
- If a provider (Vercel, Render, Neon) changes, or new data is collected, update [PrivacyPolicy.jsx](../frontend/src/pages/PrivacyPolicy.jsx) and bump `privacyUpdated` in `site.js`.
- The policy and terms are written from the application's behaviour and are a plain-language starting point, not legal advice. They name no governing law, company registration or postal address: add them in the two page files if you need them.
