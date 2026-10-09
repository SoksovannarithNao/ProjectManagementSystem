package backend.dto;

import backend.entity.TaskApproval;

import java.time.OffsetDateTime;

public class TaskApprovalResponse {

    private final Long id;
    private final Long taskId;
    private final String taskTitle;
    private final Long projectId;
    private final String projectName;
    private final UserResponse requestedBy;
    private final OffsetDateTime requestedAt;
    private final UserResponse decidedBy;
    private final OffsetDateTime decidedAt;
    private final String decision;
    private final String comment;

    public TaskApprovalResponse(TaskApproval approval) {
        this.id = approval.getId();
        this.taskId = approval.getTask().getId();
        this.taskTitle = approval.getTask().getTitle();
        this.projectId = approval.getTask().getProject().getId();
        this.projectName = approval.getTask().getProject().getName();
        this.requestedBy = approval.getRequestedBy() != null ? new UserResponse(approval.getRequestedBy()) : null;
        this.requestedAt = approval.getRequestedAt();
        this.decidedBy = approval.getDecidedBy() != null ? new UserResponse(approval.getDecidedBy()) : null;
        this.decidedAt = approval.getDecidedAt();
        this.decision = approval.getDecision();
        this.comment = approval.getComment();
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public UserResponse getRequestedBy() {
        return requestedBy;
    }

    public OffsetDateTime getRequestedAt() {
        return requestedAt;
    }

    public UserResponse getDecidedBy() {
        return decidedBy;
    }

    public OffsetDateTime getDecidedAt() {
        return decidedAt;
    }

    public String getDecision() {
        return decision;
    }

    public String getComment() {
        return comment;
    }
}
