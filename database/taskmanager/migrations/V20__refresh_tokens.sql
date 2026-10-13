-- Task & Project Management System - refresh tokens for the sign-in session (checklist risk R-4).
-- Applied on top of V19__work_log_activity.sql.
--
-- The access token (a JWT) is now short-lived and kept in the browser's memory. What keeps a
-- person signed in is a random refresh token held in an httpOnly cookie; only its SHA-256 hash is
-- stored here, so a copy of this table cannot be used to sign in. A row is deleted when the
-- person signs out, changes their password or has it reset, or the account is deleted (CASCADE).
--
-- Idempotent: every step checks whether it is already done.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- The application role (created by database/init/03-app-role.sh) reads, adds and removes rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmanager_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO taskmanager_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;
    END IF;
END $$;
