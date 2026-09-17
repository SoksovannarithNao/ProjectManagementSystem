package backend.dto;

import backend.entity.Milestone;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class MilestoneResponse {

    private Long id;
    private ProjectResponse project;
    private String title;
    private String description;
    private LocalDate dueDate;
    private String status;
    private BigDecimal progress;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public MilestoneResponse(Milestone milestone) {
        this.id = milestone.getId();
        this.project = new ProjectResponse(milestone.getProject());
        this.title = milestone.getTitle();
        this.description = milestone.getDescription();
        this.dueDate = milestone.getDueDate();
        this.status = milestone.getStatus();
        this.progress = milestone.getProgress();
        this.createdAt = milestone.getCreatedAt();
        this.updatedAt = milestone.getUpdatedAt();
    }

    public Long getId() {
        return id;
    }

    public ProjectResponse getProject() {
        return project;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public String getStatus() {
        return status;
    }

    public BigDecimal getProgress() {
        return progress;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
