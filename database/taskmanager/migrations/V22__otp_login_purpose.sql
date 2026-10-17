-- Task & Project Management System - one-time codes for the administrator's sign-in.
-- Applied on top of V21__dependency_same_project.sql.
--
-- otp_verifications held only registration codes (CHECK purpose IN ('REGISTRATION')). An
-- administrator's second sign-in step e-mails a code too, so the purpose list gains LOGIN_2FA. The
-- table, its columns and the rows already in it are unchanged; each purpose keeps its own latest code.
--
-- Idempotent: the constraint is dropped if present and created again.

ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;

ALTER TABLE otp_verifications
    ADD CONSTRAINT otp_verifications_purpose_check
    CHECK (purpose IN ('REGISTRATION', 'LOGIN_2FA'));
