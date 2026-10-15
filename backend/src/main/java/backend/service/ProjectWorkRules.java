package backend.service;

import backend.entity.Project;
import backend.entity.Task;
import backend.exception.ConflictException;

// What a project's or a task's own status allows. A COMPLETED project takes nothing new: no task,
// milestone, subtask, checklist item, comment, time entry, file or dependency. A COMPLETED task takes no
// new subtask, checklist item, comment, time entry, file or dependency. Both have to be reopened (their status
// changed) first. Everything already there stays editable. Checked after the permission check, so
// a person who may not add work is told that first.
final class ProjectWorkRules {

    private ProjectWorkRules() {
    }

    // `what` completes the sentence "... before adding <what>", e.g. "tasks" or "checklist items".
    static void assertProjectAcceptsNew(Project project, String what) {
        if ("COMPLETED".equals(project.getStatus())) {
            throw new ConflictException(
                    "This project is completed. Change its status to reopen it before adding " + what + ".");
        }
    }

    // A new thing on a task: refused when its project is completed, or when the task itself is.
    static void assertTaskAcceptsNew(Task task, String what) {
        assertProjectAcceptsNew(task.getProject(), what);
        if ("COMPLETED".equals(task.getStatus())) {
            throw new ConflictException("This task is completed. Reopen it before adding " + what + ".");
        }
    }
}
