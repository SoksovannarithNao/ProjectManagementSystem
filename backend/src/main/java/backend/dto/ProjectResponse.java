package backend.dto;

import backend.entity.Project;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class ProjectResponse {

    private Long id;
    private String projectCode;
    private String name;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private UserResponse manager;
    private String priority;
    private String status;
    private BigDecimal progress;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public ProjectResponse(Project project) {
        this.id = project.getId();
        this.projectCode = project.getProjectCode();
        this.name = project.getName();
        this.description = project.getDescription();
        this.startDate = project.getStartDate();
        this.endDate = project.getEndDate();
        this.manager = new UserResponse(project.getManager());
        this.priority = project.getPriority();
        this.status = project.getStatus();
        this.progress = project.getProgress();
        this.createdAt = project.getCreatedAt();
        this.updatedAt = project.getUpdatedAt();
    }

    public Long getId() {
        return id;
    }

    public String getProjectCode() {
        return projectCode;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public UserResponse getManager() {
        return manager;
    }

    public String getPriority() {
        return priority;
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
