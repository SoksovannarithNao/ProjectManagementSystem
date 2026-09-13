package backend.dto;

import backend.entity.Subtask;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class SubtaskResponse {

    private Long id;
    private Long taskId;
    private String title;
    private Long assigneeId;
    private String assigneeName;
    private LocalDate dueDate;
    private String status;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public SubtaskResponse(Subtask subtask) {
        this.id = subtask.getId();
        this.taskId = subtask.getTask().getId();
        this.title = subtask.getTitle();
        this.assigneeId = subtask.getAssignee() != null ? subtask.getAssignee().getId() : null;
        this.assigneeName = subtask.getAssignee() != null ? subtask.getAssignee().getFullName() : null;
        this.dueDate = subtask.getDueDate();
        this.status = subtask.getStatus();
        this.createdAt = subtask.getCreatedAt();
        this.updatedAt = subtask.getUpdatedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTitle() {
        return title;
    }

    public Long getAssigneeId() {
        return assigneeId;
    }

    public String getAssigneeName() {
        return assigneeName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public String getStatus() {
        return status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
