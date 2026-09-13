-- Task & Project Management System — self-registration, OTP verification,
-- and per-user appearance/notification preferences
-- Applied on top of V2__add_permissions_progress_and_integrity_rules.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).

-- "users_account_status_check" is Postgres's auto-generated name for V1's
-- unnamed CHECK (account_status IN (...)) — add PENDING_VERIFICATION, the
-- state a self-registered account starts in until OTP verification.
ALTER TABLE users DROP CONSTRAINT users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'));

-- Appearance/notification preferences: per-user application settings,
-- distinct from the personal-info fields already on this table.
ALTER TABLE users
    ADD COLUMN theme_preference VARCHAR(10) NOT NULL DEFAULT 'SYSTEM'
        CHECK (theme_preference IN ('LIGHT', 'DARK', 'SYSTEM')),
    ADD COLUMN task_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- One-time codes for self-registration email verification. Only a bcrypt
-- hash of the code is ever stored (same PasswordEncoder bean used for user
-- passwords) — never the plaintext code, matching password-storage practice
-- elsewhere in this schema.
CREATE TABLE otp_verifications (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose      VARCHAR(30) NOT NULL DEFAULT 'REGISTRATION'
                 CHECK (purpose IN ('REGISTRATION')),
    otp_hash     VARCHAR(255) NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    attempts     INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    consumed_at  TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (attempts <= max_attempts)
);

CREATE INDEX idx_otp_verifications_user_id ON otp_verifications (user_id);
