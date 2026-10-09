package backend.security;

import java.util.Arrays;
import java.util.Optional;

// What a permission applies to. Stored as text in role_permissions.resource
// (see the CHECK constraint in database/init/01-init.sql) — keep the names in
// sync with that list and with frontend/src/api/authz.js.
public enum Resource {
    PROJECT("projects"),
    MILESTONE("milestones"),
    MEMBER("team members"),
    TASK("tasks"),
    // Changing the status/progress of a task assigned to you. Separate from TASK
    // so a Team Member can move their own work without being able to edit tasks.
    TASK_STATUS("task status"),
    SUBTASK("subtasks"),
    COMMENT("comments"),
    WORK_LOG("time entries"),
    // Files attached to a task or a project (assignment-brief.md B3.4, D-17).
    ATTACHMENT("attachments"),
    // Lightweight tick-boxes inside a task, apart from subtasks (B1.6).
    CHECKLIST_ITEM("checklist items"),
    REPORT("reports"),
    USER("users"),
    ROLE("roles and permissions"),
    // Org-wide lookup lists: positions and departments.
    LOOKUP("positions and departments");

    private final String label;

    Resource(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static Optional<Resource> parse(String value) {
        return Arrays.stream(values()).filter(r -> r.name().equals(value)).findFirst();
    }
}
