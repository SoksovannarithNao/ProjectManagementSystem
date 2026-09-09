package backend.dto;

import backend.entity.Task;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

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
    private BigDecimal progress;
    private OffsetDateTime completedAt;
    private UserResponse createdBy;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

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
}
