package backend.service;

import backend.dto.SubtaskRequest;
import backend.dto.SubtaskResponse;
import backend.entity.Subtask;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.SubtaskRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class SubtaskService {

    private final SubtaskRepository subtaskRepository;
    private final TaskRepository taskRepository;
    private final TaskDependencyRepository taskDependencyRepository;
    private final UserRepository userRepository;
    private final ActivityLogService activityLogService;
    private final ProjectAccessGuard projectAccessGuard;

    public SubtaskService(
            SubtaskRepository subtaskRepository,
            TaskRepository taskRepository,
            TaskDependencyRepository taskDependencyRepository,
            UserRepository userRepository,
            ActivityLogService activityLogService,
            ProjectAccessGuard projectAccessGuard) {
        this.subtaskRepository = subtaskRepository;
        this.taskRepository = taskRepository;
        this.taskDependencyRepository = taskDependencyRepository;
        this.userRepository = userRepository;
        this.activityLogService = activityLogService;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public List<SubtaskResponse> getSubtasksByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return subtaskRepository.findByTaskIdOrderByIdAsc(taskId).stream().map(SubtaskResponse::new).toList();
    }

    public SubtaskResponse createSubtask(SubtaskRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        projectAccessGuard.assertAccess(caller, task.getProject().getId());

        Subtask subtask = new Subtask();
        subtask.setTask(task);
        applyRequest(subtask, request);
        SubtaskResponse response = new SubtaskResponse(subtaskRepository.save(subtask));
        activityLogService.record(caller, task, "SUBTASK_ADDED", "Subtask \"" + subtask.getTitle() + "\" added");
        // Parent task status is untouched here on purpose — it's manual and
        // independent of subtask completion (see
        // database/init/01-init.sql's task/subtask completion consistency
        // section). Only its progress % is subtask-derived, and that's kept
        // current by the DB trigger there, not from here.
        return response;
    }

    public SubtaskResponse updateSubtask(Long id, SubtaskRequest request, String username) {
        User caller = requireUser(username);
        Subtask subtask = requireSubtask(id);
        projectAccessGuard.assertAccess(caller, subtask.getTask().getProject().getId());

        String previousStatus = subtask.getStatus();
        applyRequest(subtask, request);
        SubtaskResponse response = new SubtaskResponse(subtaskRepository.save(subtask));
        if (!"COMPLETED".equals(previousStatus) && "COMPLETED".equals(subtask.getStatus())) {
            activityLogService.record(caller, subtask.getTask(), "SUBTASK_COMPLETED",
                    "Subtask \"" + subtask.getTitle() + "\" completed");
        }
        startTaskIfStillToDo(caller, subtask.getTask());
        return response;
    }

    // The one deliberate exception to "task status is entirely manual,
    // independent of subtask progress" (see 01-init.sql's task/subtask
    // completion consistency section, and the Done-side gate that's the only
    // other exception): touching a subtask on a task that hasn't been
    // started yet is a clear "work has begun" signal, so it's auto-promoted
    // TO_DO -> IN_PROGRESS the first time that happens. It never does
    // anything else — a task already past TO_DO, or one a caller explicitly
    // set back to TO_DO, is left alone.
    //
    // Skipped entirely for a task "Blocked" by an incomplete dependency:
    // trg_tasks_dependencies_status_gate (01-init.sql) refuses to let a task
    // move to IN_PROGRESS while it depends on something unfinished, and
    // since this all runs in the same transaction as the subtask save,
    // attempting it anyway would throw and roll back that subtask update
    // too — silently leaving the task at TO_DO here is far less surprising
    // than a routine subtask toggle failing for a reason that has nothing to
    // do with the subtask itself.
    private void startTaskIfStillToDo(User actor, Task task) {
        if (!"TO_DO".equals(task.getStatus())) {
            return;
        }
        if (taskDependencyRepository.existsByTaskIdAndDependsOnTaskStatusNot(task.getId(), "COMPLETED")) {
            return;
        }
        task.setStatus("IN_PROGRESS");
        Task saved = taskRepository.save(task);
        activityLogService.record(actor, saved, "TASK_STATUS_CHANGED", "Status changed from To Do to In Progress");
    }

    public void deleteSubtask(Long id, String username) {
        User caller = requireUser(username);
        Subtask subtask = requireSubtask(id);
        projectAccessGuard.assertAccess(caller, subtask.getTask().getProject().getId());

        activityLogService.record(caller, subtask.getTask(), "SUBTASK_DELETED",
                "Subtask \"" + subtask.getTitle() + "\" deleted");
        subtaskRepository.delete(subtask);
    }

    private void applyRequest(Subtask subtask, SubtaskRequest request) {
        subtask.setTitle(request.getTitle());
        subtask.setDueDate(request.getDueDate());
        if (request.getStatus() != null) {
            subtask.setStatus(request.getStatus());
        }
        if (request.getAssigneeId() != null) {
            User assignee = userRepository.findById(request.getAssigneeId())
                    .orElseThrow(() -> new NotFoundException("Assignee (user) not found"));
            subtask.setAssignee(assignee);
        } else {
            subtask.setAssignee(null);
        }
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private Subtask requireSubtask(Long id) {
        return subtaskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Subtask not found"));
    }
}
