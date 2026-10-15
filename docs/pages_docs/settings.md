# Settings

**Route** `/settings` · **Access** any signed-in user · **Source** [Settings.jsx](../../frontend/src/pages/Settings.jsx)

## What it does
Two personal preferences, saved to the account.

| Setting | Options | Effect |
|---|---|---|
| Theme | Light, Dark, System | Applies at once; System follows the device's light / dark setting |
| Task notifications | on / off | Whether the person is notified in the app when assigned to a task or when one of their tasks changes status |

## How it works
- Each change is saved immediately (there is no Save button): the theme is applied locally, then both values are sent in one request, the profile is reloaded and a "Settings saved" toast appears. A failure shows an error toast.
- Controls are disabled while a save is running.
- Personal details and the password are on [Profile](profile.md).

## Data
`updateOwnPreferences()` in `api/users.js`; the theme context (`theme/ThemeContext`).
