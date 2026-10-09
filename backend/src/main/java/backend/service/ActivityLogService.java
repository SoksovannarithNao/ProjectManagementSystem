package backend.service;

import backend.dto.ActivityLogResponse;
import backend.entity.ActivityLog;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ActivityLogRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
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
    private final ProjectMemberRepository projectMemberRepository;

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ProjectMemberRepository projectMemberRepository) {
        this.activityLogRepository = activityLogRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.projectMemberRepository = projectMemberRepository;
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

    // The project-wide feed (newest first). Same visibility rule as the
    // per-task feed: members of the project, and administrators.
    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getActivityByProjectId(Long projectId, int limit, String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        projectAccessGuard.assertAccess(caller, projectId);
        int size = Math.max(1, Math.min(limit, 200));
        return activityLogRepository
                .findByProjectIdOrderByCreatedAtDescIdDesc(projectId, PageRequest.of(0, size))
                .stream()
                .map(ActivityLogResponse::new)
                .toList();
    }

    // The latest events across everything the caller may see (the dashboard's
    // "recent activities"): every project for an administrator, otherwise the
    // projects they are an active member of. `limit` is clamped to 1-50.
    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getRecentActivity(int limit, String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        PageRequest page = PageRequest.of(0, Math.max(1, Math.min(limit, 50)));
        List<ActivityLog> entries;
        if (projectAccessGuard.isAdmin(caller)) {
            entries = activityLogRepository.findAllByOrderByCreatedAtDescIdDesc(page);
        } else {
            List<Long> visible = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            entries = visible.isEmpty()
                    ? List.of()
                    : activityLogRepository.findByProjectIdInOrderByCreatedAtDescIdDesc(visible, page);
        }
        return entries.stream().map(ActivityLogResponse::new).toList();
    }

    // An event about the project itself (created, updated, a file uploaded to
    // it, a milestone) rather than about one task.
    public void recordProjectEvent(User actor, Project project, String action, String description) {
        recordForDeletedTask(actor, project, action, description);
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
