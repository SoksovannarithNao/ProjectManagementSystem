package backend.service;

import backend.dto.ApprovalDecisionRequest;
import backend.dto.TaskApprovalResponse;
import backend.dto.TaskResponse;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskApproval;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskApprovalRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.TextFormat;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// The task approval workflow (assignment-brief.md B3.8, project-workflow.md
// A6, decision D-05). IN_REVIEW is only a status; this service owns the
// separate decision on the task:
//
//   IN_PROGRESS --submit--> IN_REVIEW + PENDING request
//        PENDING --APPROVED-----------> COMPLETED
//        PENDING --CHANGES_REQUESTED--> IN_PROGRESS   (comment required)
//        PENDING --REJECTED-----------> IN_PROGRESS or CANCELLED, the approver's
//                                       choice                (comment required)
//        PENDING --task leaves review--> WITHDRAWN
//
// An approver who completes a task straight through TaskService.updateTask
// counts as approving it (recorded with their name). Every request and
// decision writes an activity entry and a notification.
//
// Who may decide: TASK:APPROVE in the project (Administrator, Project Manager
// through the Owner or Team Leader role); when the task names an approver, only
// that person, the project Owner or an Administrator; nobody may decide their
// own work (requested it, or assigned to it) except the Owner or an
// Administrator.
@Service
@Transactional
public class TaskApprovalService {

    static final String OPEN_SUBTASKS_MESSAGE = "Complete all subtasks before marking this task as done.";
    private static final int ACTIVITY_COMMENT_LIMIT = 300;

    private final TaskApprovalRepository approvalRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final SubtaskRepository subtaskRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    public TaskApprovalService(
            TaskApprovalRepository approvalRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectMemberRepository projectMemberRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            SubtaskRepository subtaskRepository,
            ProjectAccessGuard projectAccessGuard,
            NotificationService notificationService,
            ActivityLogService activityLogService) {
        this.approvalRepository = approvalRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.subtaskRepository = subtaskRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    // ------------------------------------------------------------------
    // reads
    // ------------------------------------------------------------------

    // Every request and decision made on a task, newest first.
    @Transactional(readOnly = true)
    public List<TaskApprovalResponse> getHistory(Long taskId, String username) {
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return approvalRepository.findByTaskIdOrderByRequestedAtDescIdDesc(taskId).stream()
                .map(TaskApprovalResponse::new)
                .toList();
    }

    // Open requests the caller is allowed to decide - the approver's inbox.
    @Transactional(readOnly = true)
    public List<TaskApprovalResponse> getPendingForApprover(String username) {
        User caller = requireUser(username);
        return approvalRepository.findByDecisionOrderByRequestedAtAsc(TaskApproval.PENDING).stream()
                .filter(a -> projectAccessGuard.hasAccess(caller, a.getTask().getProject().getId()))
                .filter(a -> whyNotAllowedToDecide(caller, a.getTask(), a).isEmpty())
                .map(TaskApprovalResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<TaskApproval> latestFor(Long taskId) {
        return approvalRepository.findByTaskIdOrderByRequestedAtDescIdDesc(taskId).stream().findFirst();
    }

    // The newest approval row per task for a whole task list, in one query.
    @Transactional(readOnly = true)
    public Map<Long, TaskApproval> latestByTaskIds(Collection<Long> taskIds) {
        Map<Long, TaskApproval> latest = new HashMap<>();
        if (taskIds.isEmpty()) {
            return latest;
        }
        for (TaskApproval approval : approvalRepository.findByTaskIdInOrderByRequestedAtDescIdDesc(taskIds)) {
            latest.putIfAbsent(approval.getTask().getId(), approval);
        }
        return latest;
    }

    // ------------------------------------------------------------------
    // commands
    // ------------------------------------------------------------------

    // The doer (or anyone who may edit the task) moves it from In Progress to
    // In Review and asks for a decision.
    public TaskApprovalResponse submitForReview(Long taskId, String username) {
        Task task = requireTask(taskId);
        User caller = requireUser(username);
        Long projectId = task.getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);

        if (!projectAccessGuard.can(caller, projectId, Resource.TASK, Action.EDIT)) {
            projectAccessGuard.assertCan(caller, projectId, Resource.TASK_STATUS, Action.EDIT);
            if (!taskAssigneeRepository.existsByTaskIdAndUserId(taskId, caller.getId())) {
                throw new AccessDeniedException("You are not assigned to this task");
            }
        }
        if (!"IN_PROGRESS".equals(task.getStatus())) {
            throw new IllegalArgumentException("Only a task that is in progress can be submitted for review");
        }

        changeStatus(task, caller, "IN_REVIEW");
        return new TaskApprovalResponse(openRequest(task, caller));
    }

    // An approver decides the open request.
    public TaskApprovalResponse decide(Long taskId, ApprovalDecisionRequest request, String username) {
        Task task = requireTask(taskId);
        User caller = requireUser(username);
        Long projectId = task.getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);

        TaskApproval pending = approvalRepository.findFirstByTaskIdAndDecision(taskId, TaskApproval.PENDING)
                .orElseThrow(() -> new IllegalArgumentException("This task has no pending approval request"));
        whyNotAllowedToDecide(caller, task, pending).ifPresent(reason -> {
            throw new AccessDeniedException(reason);
        });

        String decision = request.getDecision();
        String comment = request.getComment() == null || request.getComment().isBlank()
                ? null : request.getComment().trim();
        String nextStatus;
        switch (decision) {
            case TaskApproval.APPROVED -> {
                if (subtaskRepository.existsByTaskIdAndStatusNot(taskId, "COMPLETED")) {
                    throw new IllegalArgumentException(OPEN_SUBTASKS_MESSAGE);
                }
                nextStatus = "COMPLETED";
            }
            case TaskApproval.CHANGES_REQUESTED -> {
                requireComment(comment, "Say what has to change");
                nextStatus = "IN_PROGRESS";
            }
            case TaskApproval.REJECTED -> {
                requireComment(comment, "Say why it is rejected");
                if (request.getNextStatus() == null) {
                    throw new IllegalArgumentException("Choose what happens to a rejected task: In Progress or Cancelled");
                }
                nextStatus = request.getNextStatus();
            }
            default -> throw new IllegalArgumentException("Unknown decision: " + decision);
        }

        pending.setDecision(decision);
        pending.setDecidedBy(caller);
        pending.setDecidedAt(OffsetDateTime.now());
        pending.setComment(comment);
        approvalRepository.save(pending);

        if ("COMPLETED".equals(nextStatus)) {
            task.setProgress(new BigDecimal("100"));
        }
        changeStatus(task, caller, nextStatus);

        activityLogService.record(caller, task, activityActionFor(decision), describeDecision(caller, decision, comment, nextStatus));
        notificationService.notifyApprovalDecided(task, pending.getRequestedBy(), caller, decision, comment);
        return new TaskApprovalResponse(pending);
    }

    // Names (or clears) the approver of one task. Needs TASK:ASSIGN.
    public TaskResponse designateApprover(Long taskId, Long approverId, String username) {
        Task task = requireTask(taskId);
        User caller = requireUser(username);
        Long projectId = task.getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);
        projectAccessGuard.assertCan(caller, projectId, Resource.TASK, Action.ASSIGN);

        if (approverId == null) {
            if (task.getApprover() != null) {
                task.setApprover(null);
                activityLogService.record(caller, task, "TASK_APPROVER_SET",
                        caller.getFullName() + " removed the named approver");
            }
        } else {
            User approver = userRepository.findById(approverId)
                    .orElseThrow(() -> new NotFoundException("User not found"));
            boolean activeMember = projectMemberRepository.findByProjectIdAndUserId(projectId, approverId)
                    .filter(pm -> "ACTIVE".equals(pm.getStatus()))
                    .isPresent();
            if (!activeMember || !"ACTIVE".equals(approver.getAccountStatus())
                    || !projectAccessGuard.can(approver, projectId, Resource.TASK, Action.APPROVE)) {
                throw new IllegalArgumentException(
                        approver.getFullName() + " cannot approve tasks in this project");
            }
            boolean changed = task.getApprover() == null || !task.getApprover().getId().equals(approverId);
            task.setApprover(approver);
            if (changed) {
                activityLogService.record(caller, task, "TASK_APPROVER_SET",
                        caller.getFullName() + " named " + approver.getFullName() + " as the approver");
                // A request that is already waiting now has someone to tell.
                approvalRepository.findFirstByTaskIdAndDecision(taskId, TaskApproval.PENDING).ifPresent(pending ->
                        notificationService.notifyApprovalRequested(task, pending.getRequestedBy(), List.of(approver)));
            }
        }
        Task saved = taskRepository.save(task);
        TaskResponse response = new TaskResponse(saved);
        latestFor(taskId).ifPresent(response::setApproval);
        return response;
    }

    // ------------------------------------------------------------------
    // hooks used by TaskService.updateTask (a status change made through the
    // ordinary task edit still has to leave an approval trail)
    // ------------------------------------------------------------------

    // A task entered In Review by any route: make sure it has an open request.
    public TaskApproval openRequest(Task task, User requester) {
        Optional<TaskApproval> existing = approvalRepository.findFirstByTaskIdAndDecision(task.getId(), TaskApproval.PENDING);
        if (existing.isPresent()) {
            return existing.get();
        }
        TaskApproval approval = new TaskApproval();
        approval.setTask(task);
        approval.setRequestedBy(requester);
        TaskApproval saved = approvalRepository.save(approval);
        activityLogService.record(requester, task, "TASK_APPROVAL_REQUESTED",
                "Review requested by " + requester.getFullName());
        notificationService.notifyApprovalRequested(task, requester, approversToNotify(task, requester));
        return saved;
    }

    // An approver completed the task straight away: that is the approval.
    public void recordDirectCompletion(Task task, User approver) {
        Optional<TaskApproval> pending = approvalRepository.findFirstByTaskIdAndDecision(task.getId(), TaskApproval.PENDING);
        TaskApproval approval = pending.orElseGet(() -> {
            TaskApproval direct = new TaskApproval();
            direct.setTask(task);
            direct.setRequestedBy(approver);
            return direct;
        });
        approval.setDecision(TaskApproval.APPROVED);
        approval.setDecidedBy(approver);
        approval.setDecidedAt(OffsetDateTime.now());
        approvalRepository.save(approval);
        activityLogService.record(approver, task, "TASK_APPROVED",
                approver.getFullName() + " approved the task" + (pending.isPresent() ? "" : " (completed directly)"));
        notificationService.notifyApprovalDecided(task, approval.getRequestedBy(), approver, TaskApproval.APPROVED, null);
    }

    // The task left review with no decision (the doer moved it back, an editor
    // changed it): the open request no longer applies.
    public void withdrawPending(Task task, User actor) {
        approvalRepository.findFirstByTaskIdAndDecision(task.getId(), TaskApproval.PENDING).ifPresent(pending -> {
            pending.setDecision(TaskApproval.WITHDRAWN);
            pending.setDecidedBy(actor);
            pending.setDecidedAt(OffsetDateTime.now());
            approvalRepository.save(pending);
        });
    }

    // Used before an approver completes a task directly (PUT /api/tasks/{id}):
    // the same who-may-decide rules as a decision on a request.
    @Transactional(readOnly = true)
    public void assertMayDecide(User caller, Task task) {
        TaskApproval pending = approvalRepository.findFirstByTaskIdAndDecision(task.getId(), TaskApproval.PENDING)
                .orElse(null);
        whyNotAllowedToDecide(caller, task, pending).ifPresent(reason -> {
            throw new AccessDeniedException(reason);
        });
    }

    // ------------------------------------------------------------------
    // rules
    // ------------------------------------------------------------------

    // Empty when the caller may decide; otherwise the sentence that says why not.
    private Optional<String> whyNotAllowedToDecide(User caller, Task task, TaskApproval pending) {
        Long projectId = task.getProject().getId();
        if (!projectAccessGuard.can(caller, projectId, Resource.TASK, Action.APPROVE)) {
            return Optional.of(ProjectAccessGuard.denialMessage(Resource.TASK, Action.APPROVE, true));
        }
        boolean privileged = projectAccessGuard.isAdmin(caller)
                || projectAccessGuard.activeRole(caller, projectId).map("OWNER"::equals).orElse(false);

        User named = task.getApprover();
        if (named != null && !privileged && !named.getId().equals(caller.getId())) {
            return Optional.of(named.getFullName() + " is the approver named for this task");
        }
        if (!privileged) {
            boolean requestedByCaller = pending != null && pending.getRequestedBy() != null
                    && pending.getRequestedBy().getId().equals(caller.getId());
            if (requestedByCaller || taskAssigneeRepository.existsByTaskIdAndUserId(task.getId(), caller.getId())) {
                return Optional.of("You cannot approve your own work. Another approver has to decide");
            }
        }
        return Optional.empty();
    }

    // Who hears about a new request: the named approver, otherwise everyone in
    // the project who may approve (never the person asking).
    private List<User> approversToNotify(Task task, User requester) {
        Long projectId = task.getProject().getId();
        if (task.getApprover() != null) {
            return task.getApprover().getId().equals(requester.getId()) ? List.of() : List.of(task.getApprover());
        }
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE").stream()
                .map(ProjectMember::getUser)
                .filter(u -> !u.getId().equals(requester.getId()))
                .filter(u -> "ACTIVE".equals(u.getAccountStatus()))
                .filter(u -> projectAccessGuard.can(u, projectId, Resource.TASK, Action.APPROVE))
                .toList();
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    // Moves the task, then logs and announces the status change the way
    // TaskService.updateTask does. Flushes so a database rule (for example the
    // dependency gate) fails here, with a clean 400, not at commit.
    private void changeStatus(Task task, User actor, String nextStatus) {
        String previous = task.getStatus();
        task.setStatus(nextStatus);
        taskRepository.saveAndFlush(task);
        if (!previous.equals(nextStatus)) {
            activityLogService.record(actor, task, "TASK_STATUS_CHANGED",
                    "Status changed from " + TextFormat.humanizeEnum(previous)
                            + " to " + TextFormat.humanizeEnum(nextStatus));
            List<User> assignees = taskAssigneeRepository.findByTaskId(task.getId()).stream()
                    .map(TaskAssignee::getUser)
                    .toList();
            notificationService.notifyTaskStatusChanged(task, assignees);
        }
    }

    private static void requireComment(String comment, String message) {
        if (comment == null) {
            throw new IllegalArgumentException(message);
        }
    }

    private static String activityActionFor(String decision) {
        return switch (decision) {
            case TaskApproval.APPROVED -> "TASK_APPROVED";
            case TaskApproval.CHANGES_REQUESTED -> "TASK_CHANGES_REQUESTED";
            default -> "TASK_REJECTED";
        };
    }

    private static String describeDecision(User decider, String decision, String comment, String nextStatus) {
        String suffix = comment == null ? "" : ": " + abbreviate(comment);
        return switch (decision) {
            case TaskApproval.APPROVED -> decider.getFullName() + " approved the task" + suffix;
            case TaskApproval.CHANGES_REQUESTED -> decider.getFullName() + " requested changes" + suffix;
            default -> decider.getFullName() + " rejected the task (now "
                    + TextFormat.humanizeEnum(nextStatus) + ")" + suffix;
        };
    }

    private static String abbreviate(String text) {
        return text.length() <= ACTIVITY_COMMENT_LIMIT ? text : text.substring(0, ACTIVITY_COMMENT_LIMIT - 1) + "…";
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
