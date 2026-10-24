# Profile

**Route** `/profile` · **Access** any signed-in user, for their own account · **Source** [Profile.jsx](../../frontend/src/pages/Profile.jsx)

## What it does
Lets a person edit their own details, photo and password, connect a Google account for "Sign in with Google", and, for an account that Google created, set its first password.

## Sections
**Personal Information**
- Photo: click the avatar or **Upload / Change Photo**; **Remove** deletes it. JPEG, PNG, WEBP or GIF, up to 5 MB, checked in the browser before upload.
- The username is shown but cannot be changed.
- Editable: full name, e-mail, gender (or "Prefer not to say"), date of birth, phone number, position and department. Position and department are picked from the managed lists; only an Administrator adds new entries, so there is no "add new" here.
- **Save Changes** sends the form and then reloads the profile so the rest of the app (top bar, avatar) updates.

**Set a password** (`components/GoogleSetPasswordSection.jsx`; shown **instead of** Password, only for an account that Google created and that has none yet)
- New password and confirmation with the live rule checklist, then Google's button *Continue with Google*, which confirms the choice with the connected Google account and sends it; a weak or non-matching password is refused in the page before anything is sent. When it succeeds the Password card below takes its place.

**Password**
- Current password, new password and confirmation, with the live rule checklist. The browser refuses a weak or non-matching new password before sending. Fields are cleared after a successful change.

**Sign in with Google** (`components/GoogleSignInSection.jsx`; shown only when the server has `GOOGLE_CLIENT_ID`, otherwise the card is absent)
- Layout: the same card style as the Password card. On a wide screen the password field and Google's button sit side by side at the same 40px height; on a phone they stack and the button takes the full width. The button is Google's own (its logo and wording cannot be restyled): the dark variant on the dark theme, the outline variant on the light one, in English.
- Not connected: type the **current password** (it proves the account is yours), then choose the Google account in Google's button; the card then says *Connected to name@gmail.com*. An empty password is refused in the page before anything is sent; the server checks the password first and refuses a wrong one, a Google account another account already holds, and a second connection.
- Connected: a *Connected* badge with the Google address, and **Disconnect** (a secondary button), which removes the link at once. It is disabled, with a hint, while the account has no password yet. The password keeps working either way, so nobody is locked out. See [google-sign-in.md](../google-sign-in.md).

## Notes
- Theme and notification preferences are on [Settings](settings.md), not here; the two pages use separate endpoints and never touch each other's fields.
- Success and failure of the photo actions appear as toasts; the profile and password forms show errors under the form.

## Data
`api/users.js` (own profile, password, photo, the Google connection: `getGoogleStatus`, `linkGoogle`, `unlinkGoogle`), `api/useGoogleClientId.js`, `api/positions.js`, `api/departments.js`, `api/validation.js` (password rules).
