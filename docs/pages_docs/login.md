# Login

**Route** `/login` · **Access** public · **Source** [Login.jsx](../../frontend/src/pages/Login.jsx)

## What it does
Signs a person in with their username **or** e-mail and a password, or, optionally, with Google ([ADR-0017](../adr/0017-link-only-google-sign-in.md), [ADR-0018](../adr/0018-google-sign-up-and-first-password.md)): an account that was connected to the Google account on its [Profile](profile.md) signs in, and a person with no account creates one.

## How it works
1. The form sends the two fields to `login()` from the auth context.
2. On success the user goes back to the page they first asked for (kept in the router state), otherwise to the dashboard.
3. On failure the server's message is shown under the fields (for example a wrong password, or a paused sign-in after repeated failures).
4. If the app signed the user out for inactivity, a notice says so once; it is cleared as soon as the page opens.
5. When the server has `GOOGLE_CLIENT_ID` (asked from `GET /api/auth/google/config` by `api/useGoogleClientId.js`), a divider and **Google's own "Sign in with Google" button** (`components/GoogleButton.jsx`) appear under the form. Choosing a Google account hands the signed ID token to `loginWithGoogle()`; it answers like the password form (the session, or for an administrator the same code form below). The button says *Continue with Google* and the page adds "New here? Google creates your TaskFlow account." A Google account that is connected to nobody and whose e-mail no account uses gets the **username step** (*Choose a username*, with the e-mail Google confirmed; `components/GoogleSignupForm.jsx`): a taken username shows the server's message and the form stays, *Cancel* returns to the sign-in form, and success creates the account and signs in. An e-mail that an account already uses is refused under the button with the way forward. If the server has no client ID, or Google's script cannot load, nothing is drawn and the password form is all there is.
6. For an **administrator**, when the server has `ADMIN_2FA_ENABLED=true`, a correct password does not sign in yet: the page switches to a second form ("Enter your sign-in code", with the masked e-mail the code went to). The 6-digit code goes to `loginWithCode()`; "Back to sign in" returns to the password form. Other users never see this step.
7. A link leads to [Register](register.md) (hidden while the code form is shown, as is the Google button), and small links under the card lead to the [Privacy Policy](privacy-policy.md) and the [Terms of Service](terms-of-service.md).

## Notes
- The page is outside the protected routes and the app layout, so it has no sidebar or top bar.
- The session itself (access token in memory, refresh cookie) is handled by the auth context, not by this page.
