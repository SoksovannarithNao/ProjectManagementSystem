package backend.dto;

import backend.entity.ChecklistItem;

import java.time.OffsetDateTime;

public class ChecklistItemResponse {

    private final Long id;
    private final Long taskId;
    private final String content;
    private final boolean completed;
    private final int sortOrder;
    private final Long createdById;
    private final String createdByName;
    private final OffsetDateTime createdAt;

    public ChecklistItemResponse(ChecklistItem item) {
        this.id = item.getId();
        this.taskId = item.getTask().getId();
        this.content = item.getContent();
        this.completed = item.isCompleted();
        this.sortOrder = item.getSortOrder();
        this.createdById = item.getCreatedBy() != null ? item.getCreatedBy().getId() : null;
        this.createdByName = item.getCreatedBy() != null ? item.getCreatedBy().getFullName() : null;
        this.createdAt = item.getCreatedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getContent() {
        return content;
    }

    public boolean isCompleted() {
        return completed;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Long getCreatedById() {
        return createdById;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
