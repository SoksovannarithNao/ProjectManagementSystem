-- Task & Project Management System — enforce project ownership integrity.
-- Applied on top of V7__add_default_global_user_role.sql.
-- This is the versioned migration form of the same delta added to
-- database/init/01-init.sql for this change — see that file for the
-- authoritative, actually-executed SQL (Docker/CI run init/*.sql, not this
-- migrations folder — see database/README.md's Migrations section).
--
-- Problem: nothing stopped a project's last remaining OWNER from being
-- demoted, removed, or having their user account deleted (project_members
-- rows are ON DELETE CASCADE from users) — leaving the project permanently
-- ownerless, since granting OWNER requires already being one
-- (ProjectAccessGuard.assertIsOwner). Fix: a trigger that refuses to
-- update/delete a project_members row away from ACTIVE-OWNER whenever it's
-- the project's only one. Mirrored at the application layer in
-- ProjectMemberService.assertNotRemovingLastOwner and
-- UserService.assertNotSoleOwnerOfAnyProject; kept here too because the
-- ON DELETE CASCADE path from `users` never goes through that Java code.

CREATE OR REPLACE FUNCTION check_project_has_active_owner()
RETURNS TRIGGER AS $$
DECLARE
    v_remaining_owners INTEGER;
BEGIN
    IF OLD.project_role <> 'OWNER' OR OLD.status <> 'ACTIVE' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.project_role = 'OWNER' AND NEW.status = 'ACTIVE' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_remaining_owners
    FROM project_members
    WHERE project_id = OLD.project_id AND project_role = 'OWNER' AND status = 'ACTIVE'
      AND id <> OLD.id;

    IF v_remaining_owners = 0 THEN
        RAISE EXCEPTION 'Project % must keep at least one active owner — promote another member to OWNER first',
            OLD.project_id
            USING ERRCODE = '23514';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_members_owner_integrity
    BEFORE UPDATE OR DELETE ON project_members
    FOR EACH ROW EXECUTE FUNCTION check_project_has_active_owner();
