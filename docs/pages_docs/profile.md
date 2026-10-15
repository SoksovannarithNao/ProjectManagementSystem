# Profile

**Route** `/profile` · **Access** any signed-in user, for their own account · **Source** [Profile.jsx](../../frontend/src/pages/Profile.jsx)

## What it does
Lets a person edit their own details, photo and password.

## Sections
**Personal Information**
- Photo: click the avatar or **Upload / Change Photo**; **Remove** deletes it. JPEG, PNG, WEBP or GIF, up to 5 MB, checked in the browser before upload.
- The username is shown but cannot be changed.
- Editable: full name, e-mail, gender (or "Prefer not to say"), date of birth, phone number, position and department. Position and department are picked from the managed lists; only an Administrator adds new entries, so there is no "add new" here.
- **Save Changes** sends the form and then reloads the profile so the rest of the app (top bar, avatar) updates.

**Password**
- Current password, new password and confirmation, with the live rule checklist. The browser refuses a weak or non-matching new password before sending. Fields are cleared after a successful change.

## Notes
- Theme and notification preferences are on [Settings](settings.md), not here; the two pages use separate endpoints and never touch each other's fields.
- Success and failure of the photo actions appear as toasts; the profile and password forms show errors under the form.

## Data
`api/users.js` (own profile, password, photo), `api/positions.js`, `api/departments.js`, `api/validation.js` (password rules).
