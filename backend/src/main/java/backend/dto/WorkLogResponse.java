package backend.dto;

import backend.entity.WorkLog;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class WorkLogResponse {

    private final Long id;
    private final Long taskId;
    private final Long userId;
    private final String authorName;
    private final LocalDate workDate;
    private final BigDecimal hoursWorked;
    private final String description;
    private final OffsetDateTime createdAt;

    public WorkLogResponse(WorkLog log) {
        this.id = log.getId();
        this.taskId = log.getTask().getId();
        this.userId = log.getUser().getId();
        this.authorName = log.getUser().getFullName();
        this.workDate = log.getWorkDate();
        this.hoursWorked = log.getHoursWorked();
        this.description = log.getDescription();
        this.createdAt = log.getCreatedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public String getDescription() {
        return description;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
