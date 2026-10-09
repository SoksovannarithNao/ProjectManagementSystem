package backend.dto;

import backend.entity.Task;
import backend.entity.TaskApproval;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public class TaskResponse {

    private Long id;
    private ProjectResponse project;
    private MilestoneResponse milestone;
    private String title;
    private String description;
    private String priority;
    private String status;
    private LocalDate startDate;
    private LocalDate dueDate;
    private BigDecimal estimatedHours;
    // Sum of this task's work logs; set by TaskService from one batched query.
    private BigDecimal actualHours = BigDecimal.ZERO;
    private BigDecimal progress;
    private OffsetDateTime completedAt;
    private UserResponse createdBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private long totalSubtasks;
    private long completedSubtasks;
    // Checklist items count toward progress together with subtasks (D-07).
    private long totalChecklistItems;
    private long completedChecklistItems;
    private boolean overdue;
    private boolean blocked;
    private List<String> blockingTaskTitles = List.of();
    // The approver named for this task, if any, and the newest approval
    // request on it (PENDING / APPROVED / CHANGES_REQUESTED / REJECTED /
    // WITHDRAWN, null when it was never submitted).
    private UserResponse approver;
    private String approvalStatus;
    private UserResponse approvalRequestedBy;
    private OffsetDateTime approvalRequestedAt;

    public TaskResponse(Task task) {
        this.id = task.getId();
        this.project = new ProjectResponse(task.getProject());
        this.milestone = task.getMilestone() != null ? new MilestoneResponse(task.getMilestone()) : null;
        this.title = task.getTitle();
        this.description = task.getDescription();
        this.priority = task.getPriority();
        this.status = task.getStatus();
        this.startDate = task.getStartDate();
        this.dueDate = task.getDueDate();
        this.estimatedHours = task.getEstimatedHours();
        this.progress = task.getProgress();
        this.completedAt = task.getCompletedAt();
        this.createdBy = task.getCreatedBy() != null ? new UserResponse(task.getCreatedBy()) : null;
        this.createdAt = task.getCreatedAt();
        this.updatedAt = task.getUpdatedAt();
        this.approver = task.getApprover() != null ? new UserResponse(task.getApprover()) : null;
        // Mirrors database/init/01-init.sql's v_overdue_tasks view exactly
        // (due_date < today and not COMPLETED/CANCELLED) — computed here
        // instead of querying that view, since the inputs are already on
        // hand and it's a two-field comparison.
        this.overdue = task.getDueDate() != null
                && task.getDueDate().isBefore(LocalDate.now())
                && !"COMPLETED".equals(task.getStatus())
                && !"CANCELLED".equals(task.getStatus());
    }

    // Subtask counts are computed separately from a single grouped query
    // across a whole task list (see TaskService.subtaskCountsByTaskId) rather
    // than fetched per task here, to avoid an N+1 subtask query per task.
    public TaskResponse(Task task, long totalSubtasks, long completedSubtasks) {
        this(task);
        this.totalSubtasks = totalSubtasks;
        this.completedSubtasks = completedSubtasks;
    }

    public Long getId() {
        return id;
    }

    public ProjectResponse getProject() {
        return project;
    }

    public MilestoneResponse getMilestone() {
        return milestone;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getPriority() {
        return priority;
    }

    public String getStatus() {
        return status;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public BigDecimal getProgress() {
        return progress;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public UserResponse getCreatedBy() {
        return createdBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public long getTotalChecklistItems() {
        return totalChecklistItems;
    }

    public long getCompletedChecklistItems() {
        return completedChecklistItems;
    }

    // Set from one batched query across the whole task list (TaskService.toResponses).
    public void setChecklistCounts(long total, long completed) {
        this.totalChecklistItems = total;
        this.completedChecklistItems = completed;
    }

    public long getTotalSubtasks() {
        return totalSubtasks;
    }

    public long getCompletedSubtasks() {
        return completedSubtasks;
    }

    public BigDecimal getActualHours() {
        return actualHours;
    }

    public void setActualHours(BigDecimal actualHours) {
        this.actualHours = actualHours != null ? actualHours : BigDecimal.ZERO;
    }

    public boolean isOverdue() {
        return overdue;
    }

    public boolean isBlocked() {
        return blocked;
    }

    // Set separately from a batched query across the whole task list (see
    // TaskService.toResponses / TaskDependencyRepository.findBlockingTasks)
    // rather than computed per task here, same reasoning as totalSubtasks.
    public void setBlocked(boolean blocked) {
        this.blocked = blocked;
    }

    // Titles of this task's own not-yet-COMPLETED dependencies — what's
    // actually keeping it Blocked, so the UI can say *what* to finish
    // rather than just that it's stuck. Same batched-query origin as
    // `blocked` itself.
    public UserResponse getApprover() {
        return approver;
    }

    public String getApprovalStatus() {
        return approvalStatus;
    }

    public UserResponse getApprovalRequestedBy() {
        return approvalRequestedBy;
    }

    public OffsetDateTime getApprovalRequestedAt() {
        return approvalRequestedAt;
    }

    // From the newest approval row of this task, set from one batched query
    // across the whole task list (TaskService.toResponses).
    public void setApproval(TaskApproval approval) {
        this.approvalStatus = approval != null ? approval.getDecision() : null;
        this.approvalRequestedBy = approval != null && approval.getRequestedBy() != null
                ? new UserResponse(approval.getRequestedBy()) : null;
        this.approvalRequestedAt = approval != null ? approval.getRequestedAt() : null;
    }

    public List<String> getBlockingTaskTitles() {
        return blockingTaskTitles;
    }

    public void setBlockingTaskTitles(List<String> blockingTaskTitles) {
        this.blockingTaskTitles = blockingTaskTitles;
    }
}
