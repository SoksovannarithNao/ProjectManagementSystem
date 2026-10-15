package backend.exception;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// What a person is told when PostgreSQL refuses a write (issue I-11). A CHECK, UNIQUE, FOREIGN KEY or
// NOT NULL violation names a table, column or constraint ("new row for relation "tasks" violates check
// constraint "tasks_check""), which says nothing useful and shows how the database is built, so each is
// turned into a plain sentence: a fixed one for the constraints a user can really hit, a general one
// for the rest. The message a trigger raises (RAISE EXCEPTION in database/init/01-init.sql) is already
// a sentence written for people and is passed through, without the "ERROR: " prefix and the "Where:"
// lines the driver adds.
final class DatabaseMessages {

    private static final Pattern CONSTRAINT = Pattern.compile("constraint \"([^\"]+)\"");

    private static final Map<String, String> BY_CONSTRAINT = Map.ofEntries(
            Map.entry("idx_users_username_lower", "That username is already taken."),
            Map.entry("idx_users_email_lower", "That email address is already registered."),
            Map.entry("idx_departments_name_lower", "A department with that name already exists."),
            Map.entry("idx_positions_name_lower", "A position with that name already exists."),
            Map.entry("roles_name_key", "A role with that name already exists."),
            Map.entry("project_members_project_id_user_id_key", "That person is already on this project."),
            Map.entry("task_assignees_task_id_user_id_key", "That person is already assigned to this task."),
            Map.entry("uq_task_approvals_one_pending", "This task already has an approval request waiting for a decision."),
            Map.entry("projects_check", "The project end date cannot be before its start date."),
            Map.entry("tasks_check", "The task due date cannot be before its start date."),
            Map.entry("projects_progress_check", "Progress must be between 0 and 100."),
            Map.entry("tasks_progress_check", "Progress must be between 0 and 100."),
            Map.entry("milestones_progress_check", "Progress must be between 0 and 100."),
            Map.entry("work_logs_hours_worked_check", "Hours worked must be more than 0."),
            Map.entry("task_dependencies_check", "A task cannot depend on itself."),
            Map.entry("attachments_check", "A file belongs to a project or to a task, not to both."));

    private DatabaseMessages() {
    }

    // rootMessage: the message of the most specific cause (may be null or blank).
    static String forViolation(String rootMessage) {
        if (rootMessage == null || rootMessage.isBlank()) {
            return "One or more fields are invalid";
        }
        String firstLine = rootMessage.split("\\r?\\n", 2)[0].trim();
        String message = firstLine.startsWith("ERROR: ") ? firstLine.substring("ERROR: ".length()) : firstLine;

        Matcher constraint = CONSTRAINT.matcher(message);
        String name = constraint.find() ? constraint.group(1) : null;
        if (message.contains("violates unique constraint")) {
            return name != null && BY_CONSTRAINT.containsKey(name) ? BY_CONSTRAINT.get(name) : "That value is already in use.";
        }
        if (message.contains("violates check constraint")) {
            if (name != null && BY_CONSTRAINT.containsKey(name)) {
                return BY_CONSTRAINT.get(name);
            }
            if (name != null && name.endsWith("_status_check")) {
                return "That status is not allowed.";
            }
            if (name != null && name.endsWith("_priority_check")) {
                return "That priority is not allowed.";
            }
            return "One or more values are not allowed.";
        }
        if (message.contains("violates foreign key constraint")) {
            return "This item is linked to other records, so the change is not allowed.";
        }
        if (message.contains("violates not-null constraint")) {
            return "A required value is missing.";
        }
        return message;
    }
}
