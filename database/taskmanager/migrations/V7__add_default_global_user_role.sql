-- Task & Project Management System — default global USER role.
-- Applied on top of V6__store_profile_photo_in_database.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).
--
-- Problem: a self-registered account had no roles row at all (role_id
-- NULL), same as it would have if we simply forgot to assign one. There was
-- no way to tell "a real account with no global role" apart from "a global
-- role hasn't been wired up yet", and nothing distinguished a genuine
-- registered account at a glance. Fix: give every self-registered account
-- an explicit USER role. It carries zero permission bypass — it exists
-- purely as an account-level label; every permission check
-- (ProjectAccessGuard.isAdmin and friends) still only special-cases
-- ADMINISTRATOR, so this is a no-op for authorization. All project/task
-- authority still comes entirely from project_members.project_role.

INSERT INTO roles (name, description) VALUES
    ('USER', 'Standard registered account — no special access; all authority comes from project membership');

-- Backfill: existing accounts that predate this change and never got a
-- global role (i.e. everyone except ADMINISTRATOR) become USER too, for
-- consistency going forward. This changes no permission outcome for them —
-- USER is checked nowhere.
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'USER')
WHERE role_id IS NULL;
