-- Task & Project Management System — store profile photos in the database.
-- Applied on top of V5__project_scoped_authorization.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).
--
-- Problem: users.profile_photo_url (from V1) pointed at a file on local
-- disk. That's fine for a single always-on host, but this project is meant
-- to be hosted — moving to a new host, restoring from a pg_dump, or using a
-- managed Postgres service would all silently leave every uploaded photo
-- behind, since only the database travels, not the local filesystem. Fix:
-- store the photo bytes directly in the users row instead.

ALTER TABLE users DROP COLUMN profile_photo_url;

ALTER TABLE users ADD COLUMN profile_photo BYTEA;
ALTER TABLE users ADD COLUMN profile_photo_content_type VARCHAR(50);
-- Public lookup key (PhotoController), regenerated on every upload — never
-- the user's id, which would make every user's photo enumerable, and never
-- reused, so a re-upload can't be served from a stale cached URL.
ALTER TABLE users ADD COLUMN profile_photo_token UUID;

CREATE UNIQUE INDEX idx_users_profile_photo_token ON users (profile_photo_token) WHERE profile_photo_token IS NOT NULL;
