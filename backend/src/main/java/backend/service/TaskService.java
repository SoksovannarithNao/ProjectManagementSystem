package backend.service;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.TaskApproval;
import backend.entity.User;
import backend.entity.TaskAssignee;
import backend.exception.NotFoundException;
import backend.repository.ChecklistItemRepository;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.util.TextFormat;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    private final WorkLogRepository workLogRepository;
    private final TaskApprovalService approvalService;
    private final ChecklistItemRepository checklistItemRepository;

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
            ProjectAccessGuard projectAccessGuard,
            WorkLogRepository workLogRepository,
            TaskApprovalService approvalService,
            ChecklistItemRepository checklistItemRepository) {
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
        this.workLogRepository = workLogRepository;
        this.approvalService = approvalService;
        this.checklistItemRepository = checklistItemRepository;
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
        Map<Long, BigDecimal> loggedHours = new HashMap<>();
        for (var row : workLogRepository.sumHoursByTaskIds(taskIds)) {
            loggedHours.put(row.getTaskId(), row.getHours());
        }
        Map<Long, TaskApproval> latestApprovals = approvalService.latestByTaskIds(taskIds);
        Map<Long, long[]> checklistCounts = new HashMap<>();
        for (var row : checklistItemRepository.countByTaskIds(taskIds)) {
            checklistCounts.put(row.getTaskId(), new long[] { row.getTotal(), row.getCompleted() });
        }
        Map<Long, List<String>> blockingTitles = new HashMap<>();
        for (var row : taskDependencyRepository.findBlockingTasks(taskIds)) {
            blockingTitles.computeIfAbsent(row.getTaskId(), k -> new ArrayList<>()).add(row.getTitle());
        }
        return tasks.stream()
                .map(t -> {
                    long[] c = counts.getOrDefault(t.getId(), new long[] { 0, 0 });
                    TaskResponse response = new TaskResponse(t, c[0], c[1]);
                    List<String> titles = blockingTitles.getOrDefault(t.getId(), List.of());
                    response.setActualHours(loggedHours.get(t.getId()));
                    response.setBlocked(!titles.isEmpty());
                    response.setBlockingTaskTitles(titles);
                    response.setApproval(latestApprovals.get(t.getId()));
                    long[] items = checklistCounts.getOrDefault(t.getId(), new long[] { 0, 0 });
                    response.setChecklistCounts(items[0], items[1]);
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
        projectAccessGuard.assertCan(caller, request.getProjectId(), Resource.TASK, Action.CREATE);

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
        Long currentProjectId = task.getProject().getId();
        if (newlyCompleting) {
            // Marking a task Completed is an approval, not just a status change:
            // it needs TASK:APPROVE (Project Manager, Team Leader, Administrator).
            // A Team Member moves their work to In Review and an approver
            // completes it. Checked before the subtask rule so the caller learns
            // first that they may not do this at all.
            projectAccessGuard.assertCan(caller, currentProjectId, Resource.TASK, Action.APPROVE);
            // ...and a completion made here counts as the approval, so the same
            // who-may-decide rules apply (named approver, no approving your own work).
            approvalService.assertMayDecide(caller, task);
            assertNotCompletingWithOpenSubtasks(id);
        }

        if (projectAccessGuard.can(caller, currentProjectId, Resource.TASK, Action.EDIT)) {
            // Moving a task to another project is a write into THAT project
            // too — being able to manage the project it's leaving isn't
            // enough, otherwise a project owner/admin could push tasks into
            // any project in the system, including ones they can't even see.
            if (request.getProjectId() != null && !request.getProjectId().equals(currentProjectId)) {
                projectAccessGuard.assertCan(caller, request.getProjectId(), Resource.TASK, Action.EDIT);
                // The approver named in the old project may not belong to the new one.
                task.setApprover(null);
            }
            applyRequest(task, request);
        } else {
            // Without TASK:EDIT the caller may only change status/progress of a task
            // assigned to them (TASK_STATUS:EDIT). A VIEWER has neither, so is
            // read-only even for a task that was assigned to them.
            projectAccessGuard.assertCan(caller, currentProjectId, Resource.TASK_STATUS, Action.EDIT);
            if (!taskAssigneeRepository.existsByTaskIdAndUserId(id, caller.getId())) {
                throw new AccessDeniedException("You are not assigned to this task");
            }
            applyStatusAndProgressOnly(task, request);
        }

        Task saved = taskRepository.save(task);
        logFieldChanges(caller, saved, previousStatus, previousPriority, previousDueDate);

        if (previousStatus != null && !previousStatus.equals(saved.getStatus())) {
            // Keep the approval trail in step with the status, whichever screen changed it.
            if ("COMPLETED".equals(saved.getStatus())) {
                approvalService.recordDirectCompletion(saved, caller);
            } else if ("IN_REVIEW".equals(saved.getStatus())) {
                approvalService.openRequest(saved, caller);
            } else if ("IN_REVIEW".equals(previousStatus)) {
                approvalService.withdrawPending(saved, caller);
            }
            List<User> assignees = taskAssigneeRepository.findByTaskId(saved.getId())
                    .stream()
                    .map(TaskAssignee::getUser)
                    .toList();
            notificationService.notifyTaskStatusChanged(saved, assignees);
        }

        TaskResponse response = new TaskResponse(saved);
        response.setActualHours(workLogRepository.sumHoursByTaskId(saved.getId()));
        approvalService.latestFor(saved.getId()).ifPresent(response::setApproval);
        return response;
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
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.TASK, Action.DELETE);
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
