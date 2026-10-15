# Login

**Route** `/login` · **Access** public · **Source** [Login.jsx](../../frontend/src/pages/Login.jsx)

## What it does
Signs a person in with their username **or** e-mail and a password.

## How it works
1. The form sends the two fields to `login()` from the auth context.
2. On success the user goes back to the page they first asked for (kept in the router state), otherwise to the dashboard.
3. On failure the server's message is shown under the fields (for example a wrong password, or a paused sign-in after repeated failures).
4. If the app signed the user out for inactivity, a notice says so once; it is cleared as soon as the page opens.
5. A link leads to [Register](register.md).

## Notes
- The page is outside the protected routes and the app layout, so it has no sidebar or top bar.
- The session itself (access token in memory, refresh cookie) is handled by the auth context, not by this page.
