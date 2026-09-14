package backend.service;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.entity.TaskAssignee;
import backend.exception.NotFoundException;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.util.TextFormat;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final MilestoneRepository milestoneRepository;
    private final UserRepository userRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final SubtaskRepository subtaskRepository;
    private final TaskDependencyRepository taskDependencyRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;
    private final ProjectAccessGuard projectAccessGuard;

    public TaskService(
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            MilestoneRepository milestoneRepository,
            UserRepository userRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            SubtaskRepository subtaskRepository,
            TaskDependencyRepository taskDependencyRepository,
            NotificationService notificationService,
            ActivityLogService activityLogService,
            ProjectAccessGuard projectAccessGuard) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.milestoneRepository = milestoneRepository;
        this.userRepository = userRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.subtaskRepository = subtaskRepository;
        this.taskDependencyRepository = taskDependencyRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Scoped by project membership (Role_Requirment.md / Project_requirement_plan.md
    // §28: "Users should only view Projects and Tasks for which they have
    // permission") — ADMINISTRATOR retains full visibility; everyone else
    // only sees tasks in projects they're a member of. A task's assignee is
    // always already a project member (trg_task_assignees_project_member
    // enforces this), so project membership alone is a strict superset of
    // "tasks assigned to me" — no separate assignee-based clause is needed.
    @Transactional(readOnly = true)
    public List<TaskResponse> getAllTasks(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<Task> tasks;
        if (projectAccessGuard.isAdmin(caller)) {
            tasks = taskRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            tasks = taskRepository.findByProjectIdIn(visibleProjectIds);
        }

        return toResponses(tasks);
    }

    @Transactional(readOnly = true)
    public TaskResponse getTaskById(Long id, String username) {
        Task task = getTaskEntityById(id);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return toResponses(List.of(task)).get(0);
    }

    @Transactional(readOnly = true)
    public Task getTaskEntityById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByProjectId(Long projectId, String username) {
        projectAccessGuard.assertAccess(requireUser(username), projectId);
        return toResponses(taskRepository.findByProjectId(projectId));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByMilestoneId(Long milestoneId, String username) {
        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> new NotFoundException("Milestone not found"));
        projectAccessGuard.assertAccess(requireUser(username), milestone.getProject().getId());
        return toResponses(taskRepository.findByMilestoneId(milestoneId));
    }

    // Global "every task with this status" scoped down to the caller's own
    // visible projects, same as getAllTasks — otherwise a non-admin could
    // enumerate every task in the system regardless of project membership.
    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByStatus(String status, String username) {
        User caller = requireUser(username);
        List<Task> tasks;
        if (projectAccessGuard.isAdmin(caller)) {
            tasks = taskRepository.findByStatus(status);
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            tasks = taskRepository.findByStatus(status).stream()
                    .filter(t -> visibleProjectIds.contains(t.getProject().getId()))
                    .toList();
        }
        return toResponses(tasks);
    }

    // Batches subtask counts for a whole task list into one grouped query
    // (SubtaskRepository.countByTaskIds) instead of a per-task fetch, so
    // TaskResponse.totalSubtasks/completedSubtasks (the list pages' "N/M
    // subtasks" progress) doesn't turn every task list into an N+1 query.
    private List<TaskResponse> toResponses(List<Task> tasks) {
        if (tasks.isEmpty()) {
            return List.of();
        }
        List<Long> taskIds = tasks.stream().map(Task::getId).toList();
        Map<Long, long[]> counts = new HashMap<>();
        for (var row : subtaskRepository.countByTaskIds(taskIds)) {
            counts.put(row.getTaskId(), new long[] { row.getTotal(), row.getCompleted() });
        }
        Set<Long> blockedTaskIds = new HashSet<>(taskDependencyRepository.findBlockedTaskIds(taskIds));
        return tasks.stream()
                .map(t -> {
                    long[] c = counts.getOrDefault(t.getId(), new long[] { 0, 0 });
                    TaskResponse response = new TaskResponse(t, c[0], c[1]);
                    response.setBlocked(blockedTaskIds.contains(t.getId()));
                    return response;
                })
                .toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    // Requires the caller to have content-edit rights (OWNER/ADMIN/MEMBER,
    // not VIEWER) on the task's project — see ProjectAccessGuard. createdBy
    // is always the caller, unless a system ADMINISTRATOR explicitly names
    // someone else via request.createdById — a plain caller's createdById
    // (if the frontend even sends one) is never trusted, closing a
    // spoofing gap this used to have.
    public TaskResponse createTask(TaskRequest request, String username) {
        User caller = requireUser(username);
        projectAccessGuard.assertCanEditContent(caller, request.getProjectId());

        Task task = new Task();
        applyRequest(task, request);
        // Override whatever applyRequest resolved from request.createdById:
        // the caller is always the creator, unless they're a system
        // ADMINISTRATOR explicitly naming someone else.
        if (request.getCreatedById() == null || !projectAccessGuard.isAdmin(caller)) {
            task.setCreatedBy(caller);
        }
        Task saved = taskRepository.save(task);
        activityLogService.record(caller, saved, "TASK_CREATED", "Task created");
        return new TaskResponse(saved);
    }

    public TaskResponse updateTask(Long id, TaskRequest request, String username) {
        Task task = getTaskEntityById(id);
        User caller = requireUser(username);

        String previousStatus = task.getStatus();
        String previousPriority = task.getPriority();
        LocalDate previousDueDate = task.getDueDate();
        String effectiveStatus = request.getStatus() != null ? request.getStatus() : task.getStatus();
        boolean newlyCompleting = !"COMPLETED".equals(previousStatus) && "COMPLETED".equals(effectiveStatus);
        if (newlyCompleting) {
            assertNotCompletingWithOpenSubtasks(id);
        }

        if (projectAccessGuard.canManage(caller, task.getProject().getId())) {
            applyRequest(task, request);
        } else {
            if (!taskAssigneeRepository.existsByTaskIdAndUserId(id, caller.getId())) {
                throw new AccessDeniedException("You are not assigned to this task");
            }
            applyStatusAndProgressOnly(task, request);
        }

        Task saved = taskRepository.save(task);
        logFieldChanges(caller, saved, previousStatus, previousPriority, previousDueDate);

        if (previousStatus != null && !previousStatus.equals(saved.getStatus())) {
            List<User> assignees = taskAssigneeRepository.findByTaskId(saved.getId())
                    .stream()
                    .map(TaskAssignee::getUser)
                    .toList();
            notificationService.notifyTaskStatusChanged(saved, assignees);
        }

        return new TaskResponse(saved);
    }

    // One activity-log row per changed field, so the panel's Activity feed
    // reads as separate, specific events ("Status changed from To Do to In
    // Progress", "Priority changed from Medium to High") rather than one
    // vague "task updated" line.
    private void logFieldChanges(
            User actor, Task saved, String previousStatus, String previousPriority, LocalDate previousDueDate) {
        if (!previousStatus.equals(saved.getStatus())) {
            activityLogService.record(actor, saved, "TASK_STATUS_CHANGED",
                    "Status changed from " + TextFormat.humanizeEnum(previousStatus)
                            + " to " + TextFormat.humanizeEnum(saved.getStatus()));
        }
        if (!previousPriority.equals(saved.getPriority())) {
            activityLogService.record(actor, saved, "TASK_PRIORITY_CHANGED",
                    "Priority changed from " + TextFormat.humanizeEnum(previousPriority)
                            + " to " + TextFormat.humanizeEnum(saved.getPriority()));
        }
        if (!java.util.Objects.equals(previousDueDate, saved.getDueDate())) {
            activityLogService.record(actor, saved, "TASK_DUE_DATE_CHANGED",
                    "Due date changed from " + (previousDueDate != null ? previousDueDate : "none")
                            + " to " + (saved.getDueDate() != null ? saved.getDueDate() : "none"));
        }
    }

    // "A task shouldn't be marked done while part of its own checklist
    // isn't." Only gates the transition INTO completed (see the
    // newlyCompleting check at the call site) — a task that's already
    // COMPLETED (however it got that way) can still have its other fields
    // edited via the same full-replace PUT without re-tripping this, since
    // the request always resends the current status unchanged. This is a
    // convenience copy for a clean, early error — database/init/01-init.sql's
    // check_task_not_completed_with_open_subtasks trigger is the actual
    // backstop that makes the bad state impossible to write at all, from any
    // caller, so the message here matches it (and TaskDetailPanel's own copy
    // of the same text) verbatim.
    private void assertNotCompletingWithOpenSubtasks(Long taskId) {
        if (subtaskRepository.existsByTaskIdAndStatusNot(taskId, "COMPLETED")) {
            throw new IllegalArgumentException("Complete all subtasks before marking this task as done.");
        }
    }

    // A caller without OWNER/ADMIN project rights, updating a task assigned
    // to them, may only change its status/progress — every other field in
    // the request (title, project, dates, etc.) is silently ignored rather
    // than rejected, since the frontend's full-replace PUT still sends the
    // whole object.
    private void applyStatusAndProgressOnly(Task task, TaskRequest request) {
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        if (request.getProgress() != null) {
            task.setProgress(request.getProgress());
        }
    }

    // Requires OWNER/ADMIN (or system ADMINISTRATOR) of the task's project.
    public void deleteTask(Long id, String username) {
        Task task = getTaskEntityById(id);
        User caller = requireUser(username);
        projectAccessGuard.assertCanManage(caller, task.getProject().getId());
        // recordForDeletedTask, not record(caller, task, ...) — see that
        // method's comment for why associating this entry with the Task
        // entity itself (even relying on ON DELETE SET NULL) trips a
        // Hibernate flush-ordering exception when the task is removed in
        // the same transaction.
        activityLogService.recordForDeletedTask(
                caller, task.getProject(), "TASK_DELETED", "Task \"" + task.getTitle() + "\" deleted");
        taskRepository.delete(task);
    }

    private void applyRequest(Task task, TaskRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new NotFoundException("Project not found"));

        Milestone milestone = null;
        if (request.getMilestoneId() != null) {
            milestone = milestoneRepository.findById(request.getMilestoneId())
                    .orElseThrow(() -> new NotFoundException("Milestone not found"));
        }

        User createdBy = null;
        if (request.getCreatedById() != null) {
            createdBy = userRepository.findById(request.getCreatedById())
                    .orElseThrow(() -> new NotFoundException("Creator (user) not found"));
        }

        task.setProject(project);
        task.setMilestone(milestone);
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        if (request.getPriority() != null) {
            task.setPriority(request.getPriority());
        }
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        task.setStartDate(request.getStartDate());
        task.setDueDate(request.getDueDate());
        task.setEstimatedHours(request.getEstimatedHours());
        if (request.getProgress() != null) {
            task.setProgress(request.getProgress());
        } else if (task.getProgress() == null) {
            task.setProgress(BigDecimal.ZERO);
        }
        task.setCompletedAt(request.getCompletedAt());
        task.setCreatedBy(createdBy);
    }
}
