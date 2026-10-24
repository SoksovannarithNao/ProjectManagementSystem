-- Task & Project Management System - accounts that Google created have no password yet.
-- Applied on top of V23__user_identities.sql.
--
-- "Sign in with Google" may now create an account (ADR-0018). Such an account has no password the person
-- knows: password_hash still holds a BCrypt hash (the column stays NOT NULL) but of random bytes nobody has
-- seen, and password_set says so. The person can set a real one from the Profile page, proving who they
-- are with Google instead of a current password. Until then the Google connection cannot be removed, or the
-- account would have no way to sign in. Every account that exists today keeps password_set = true.
--
-- Idempotent: the column is only added when it is missing.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT true;
