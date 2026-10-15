# Error page

**Routes** `/error/:status` and any unknown address (shown as 404) · **Access** signed-in users, inside the app layout · **Source** [ErrorPage.jsx](../../frontend/src/pages/ErrorPage.jsx)

## What it does
One screen for every error, so failures look the same everywhere.

## How it works
- It takes a status from the address, or from the page that renders it (the permission guard shows 403; project pages show it when a project cannot be loaded).
- Known statuses have their own title and message: 0 (cannot reach the server), 400, 401, 403, 404, 429, 500 and 502 / 503 / 504 (service unavailable). Anything else gets a generic "Something went wrong".
- Buttons: **Back to the dashboard**, **Go back**, **Help & Support**, and **Try again** only for failures that may pass (status 0 and 5xx). Try again reloads the page unless the caller passes its own retry.
- A 404 does not say whether the page is missing or off limits: the backend answers 404 for both, so nobody can probe which projects exist.
