package backend.service;

import backend.dto.WorkLogRequest;
import backend.dto.WorkLogResponse;
import backend.entity.Task;
import backend.entity.User;
import backend.entity.WorkLog;
import backend.exception.NotFoundException;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

// Time tracking (Role_Requirment.md "Time Tracking & Work Logs"): members
// record time spent on a task; the sum is the task's actual time, compared
// with its estimated hours. Access follows the same project rules as
// comments — read needs project access, logging needs content-edit rights
// (not a read-only VIEWER), changing an entry is for its author only, and deleting is
// author-or-project-manager. Each of the three is written to the task's activity feed.
@Service
@Transactional
public class WorkLogService {

    private final WorkLogRepository workLogRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final ActivityLogService activityLogService;

    public WorkLogService(
            WorkLogRepository workLogRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ActivityLogService activityLogService) {
        this.workLogRepository = workLogRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<WorkLogResponse> getWorkLogsByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return workLogRepository.findByTaskIdOrderByWorkDateDescIdDesc(taskId).stream()
                .map(WorkLogResponse::new)
                .toList();
    }

    public WorkLogResponse createWorkLog(WorkLogRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.WORK_LOG, Action.CREATE);

        if (isInTheFuture(request.getWorkDate())) {
            throw new IllegalArgumentException("Work date cannot be in the future");
        }

        WorkLog log = new WorkLog();
        log.setTask(task);
        log.setUser(caller);
        log.setWorkDate(request.getWorkDate());
        log.setHoursWorked(request.getHoursWorked());
        String description = request.getDescription() == null ? null : request.getDescription().trim();
        log.setDescription(description == null || description.isEmpty() ? null : description);
        WorkLog saved = workLogRepository.save(log);
        activityLogService.record(caller, task, "WORK_LOGGED", "Logged " + describe(saved));
        return new WorkLogResponse(saved);
    }

    // Only the person who logged the time may change it (an entry is that person's own
    // statement, so not even a manager or administrator edits it), and only while they can
    // still log time in the project. The task cannot be changed: log the time again instead.
    public WorkLogResponse updateWorkLog(Long id, WorkLogRequest request, String username) {
        User caller = requireUser(username);
        WorkLog log = workLogRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work log not found"));
        Task task = log.getTask();
        Long projectId = task.getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);
        if (!log.getUser().getId().equals(caller.getId())) {
            throw new AccessDeniedException("You can only change your own time entries");
        }
        projectAccessGuard.assertCan(caller, projectId, Resource.WORK_LOG, Action.CREATE);
        if (!task.getId().equals(request.getTaskId())) {
            throw new IllegalArgumentException("A time entry cannot be moved to another task");
        }
        if (isInTheFuture(request.getWorkDate())) {
            throw new IllegalArgumentException("Work date cannot be in the future");
        }

        String before = describe(log);
        log.setWorkDate(request.getWorkDate());
        log.setHoursWorked(request.getHoursWorked());
        String description = request.getDescription() == null ? null : request.getDescription().trim();
        log.setDescription(description == null || description.isEmpty() ? null : description);
        WorkLog saved = workLogRepository.save(log);
        String after = describe(saved);
        if (!before.equals(after)) {
            activityLogService.record(caller, task, "WORK_LOG_UPDATED", "Changed a time entry from " + before + " to " + after);
        }
        return new WorkLogResponse(saved);
    }

    public void deleteWorkLog(Long id, String username) {
        User caller = requireUser(username);
        WorkLog log = workLogRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work log not found"));
        Long projectId = log.getTask().getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);

        boolean isAuthor = log.getUser().getId().equals(caller.getId());
        if (!isAuthor && !projectAccessGuard.can(caller, projectId, Resource.WORK_LOG, Action.DELETE)) {
            throw new AccessDeniedException("You can only delete your own time entries");
        }
        String entry = describe(log);
        workLogRepository.delete(log);
        activityLogService.record(caller, log.getTask(), "WORK_LOG_DELETED",
                isAuthor ? "Deleted a time entry of " + entry
                        : "Deleted a time entry of " + entry + " logged by " + log.getUser().getFullName());
    }

    // The browser sends the person's own calendar date, which can already be tomorrow by the
    // server's clock for someone east of it (just after midnight at home, still yesterday on the
    // server), so a date up to a day ahead is accepted and only a later one is "in the future".
    private static boolean isInTheFuture(LocalDate date) {
        return date.isAfter(LocalDate.now().plusDays(1));
    }

    // "2.5 h on 2026-10-12", with the note when there is one.
    private static String describe(WorkLog log) {
        String text = log.getHoursWorked().stripTrailingZeros().toPlainString() + " h on " + log.getWorkDate();
        return log.getDescription() == null ? text : text + " (" + log.getDescription() + ")";
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }
}
