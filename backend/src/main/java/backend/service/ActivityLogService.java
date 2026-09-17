package backend.service;

import backend.dto.ActivityLogResponse;
import backend.entity.ActivityLog;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ActivityLogRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Writes to activity_logs (see database/init/01-init.sql) — a per-task
// history feed of status/priority/assignee/due-date/subtask/create/delete
// events, read by TaskDetailPanel's "Activity" section. Called from
// TaskService, TaskAssigneeService and SubtaskService at the point each of
// those changes actually happens, rather than reconstructed after the fact —
// there's no generic diffing/audit interceptor in this codebase.
@Service
@Transactional
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.activityLogRepository = activityLogRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getActivityByTaskId(Long taskId, String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return activityLogRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(ActivityLogResponse::new)
                .toList();
    }

    public void record(User actor, Task task, String action, String description) {
        ActivityLog log = new ActivityLog();
        log.setUser(actor);
        log.setProject(task.getProject());
        log.setTask(task);
        log.setAction(action);
        log.setDescription(description);
        activityLogRepository.save(log);
    }

    // For TASK_DELETED specifically: never associates the log row with the
    // Task entity at all (task_id is left null, project_id still identifies
    // where it happened). Tried making record() above log the task and rely
    // on activity_logs.task_id's ON DELETE SET NULL to survive the row being
    // deleted moments later — but even flushed immediately, a same-session
    // reference to an entity that gets removed later in the same transaction
    // trips Hibernate's flush-time transient-reference check on the final
    // pre-commit flush (TransientPropertyValueException). Skipping the
    // association from the start reaches the same end state (task_id null)
    // without the flush-ordering hazard.
    public void recordForDeletedTask(User actor, Project project, String action, String description) {
        ActivityLog log = new ActivityLog();
        log.setUser(actor);
        log.setProject(project);
        log.setAction(action);
        log.setDescription(description);
        activityLogRepository.save(log);
    }
}
