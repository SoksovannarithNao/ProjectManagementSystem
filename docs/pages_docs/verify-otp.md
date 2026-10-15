# Verify OTP

**Route** `/verify-otp` · **Access** public · **Source** [VerifyOtp.jsx](../../frontend/src/pages/VerifyOtp.jsx)

## What it does
Confirms a new account with the 6-digit code sent to the person's e-mail.

## How it works
- It only opens from [Register](register.md): the username and e-mail come in the router state, and without them the page redirects back to `/register`.
- The input accepts digits only, at most six; **Verify** stays disabled until all six are typed.
- A correct code shows "Account verified" with a link to [Login](login.md).
- **Resend OTP** asks for a new code and then waits 60 seconds before it can be used again (the button shows the countdown).

## Data
`verifyOtp()` and `resendOtp()` in `api/auth.js`.
