-- Task & Project Management System - a task dependency joins two tasks of ONE project.
-- Applied on top of V20__refresh_tokens.sql.
--
-- Workflow A4 validates "no cycle, same project" but only the cycle rule was enforced, so a
-- dependency could join a task to one of another project (issues I-15, brief G-20). The
-- service now refuses it with a 400; this trigger keeps the rule when the table is written
-- some other way. Existing rows were checked first: there is none that crosses projects, and
-- verify_invariants.sql query 15 reports any that appears.
--
-- Idempotent: the function is replaced, the trigger is dropped and created again.

CREATE OR REPLACE FUNCTION check_task_dependency_same_project()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT project_id FROM tasks WHERE id = NEW.task_id)
       IS DISTINCT FROM (SELECT project_id FROM tasks WHERE id = NEW.depends_on_task_id) THEN
        RAISE EXCEPTION 'Task % and task % belong to different projects; a dependency joins tasks of one project',
            NEW.task_id, NEW.depends_on_task_id
            USING ERRCODE = '23514'; -- check_violation, like the cycle trigger
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_dependencies_same_project ON task_dependencies;
CREATE TRIGGER trg_task_dependencies_same_project
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION check_task_dependency_same_project();
