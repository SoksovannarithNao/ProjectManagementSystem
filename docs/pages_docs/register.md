# Register

**Route** `/register` · **Access** public · **Source** [Register.jsx](../../frontend/src/pages/Register.jsx)

## What it does
Creates a new account (system role `USER`) and sends the person on to e-mail verification.

## How it works
- Fields: username (3–50 characters; letters, digits, dots, underscores, hyphens), e-mail, password, confirm password.
- A live checklist shows which password rules are met. The form refuses a password that is not complex enough, or one that does not match its confirmation, before anything is sent.
- On success it opens [Verify OTP](verify-otp.md) and passes the username and e-mail along.
- Server errors (for example a taken username) are shown under the fields.
- Under the form: "By creating an account you agree to the [Terms of Service](terms-of-service.md) and acknowledge the [Privacy Policy](privacy-policy.md)".

## Data
`register()` in `api/auth.js`.
