-- Task & Project Management System - "Sign in with Google": the link between an account and a Google identity.
-- Applied on top of V22__otp_login_purpose.sql.
--
-- An account is linked from its Profile page, after the person proves it is theirs with the current
-- password, so nothing here is ever matched by e-mail address. The key is Google's own stable account id
-- (the "sub" claim of the ID token), never the e-mail, which can change or be reassigned. One Google
-- account belongs to one TaskFlow account, and an account has at most one Google account. The e-mail is
-- kept only to show which Google account is linked. A row is deleted when the person disconnects it or
-- the account is deleted (CASCADE). The password sign-in is unchanged and still works for every account.
--
-- Idempotent: every step checks whether it is already done.

CREATE TABLE IF NOT EXISTS user_identities (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider      VARCHAR(20) NOT NULL CHECK (provider IN ('GOOGLE')),
    subject       VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT uq_user_identities_provider_subject UNIQUE (provider, subject),
    CONSTRAINT uq_user_identities_user_provider UNIQUE (user_id, provider)
);

-- The application role (created by database/init/03-app-role.sh) reads, adds, changes and removes rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON user_identities TO taskmanager_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;
    END IF;
END $$;
