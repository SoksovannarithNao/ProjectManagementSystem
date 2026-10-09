package backend.dto;

import backend.entity.Project;
import backend.util.Derived;

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
    // Calculated, never stored (assignment-brief.md B1.3): the end date has
    // passed and the project is neither Completed nor Cancelled.
    private boolean delayed;
    private long daysDelayed;

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
        LocalDate today = LocalDate.now();
        this.delayed = Derived.isProjectDelayed(project.getStatus(), project.getEndDate(), today);
        this.daysDelayed = delayed ? Derived.daysLate(project.getEndDate(), today) : 0;
    }

    public boolean isDelayed() {
        return delayed;
    }

    public long getDaysDelayed() {
        return daysDelayed;
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
