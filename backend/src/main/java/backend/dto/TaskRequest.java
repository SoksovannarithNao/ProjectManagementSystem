package backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public class TaskRequest {

    @NotNull
    private Long projectId;

    /** Optional — omit/null for a task with no milestone. */
    private Long milestoneId;

    @NotBlank
    @Size(max = 200)
    private String title;

    private String description;

    @Pattern(regexp = "LOW|MEDIUM|HIGH|URGENT")
    private String priority;

    @Pattern(regexp = "TO_DO|IN_PROGRESS|IN_REVIEW|COMPLETED|CANCELLED")
    private String status;

    @NotNull
    private LocalDate startDate;

    @NotNull
    private LocalDate dueDate;

    @DecimalMin("0")
    private BigDecimal estimatedHours;

    @DecimalMin("0")
    @DecimalMax("100")
    private BigDecimal progress;

    /** Not auto-set — see the Task Business Rules note in the README. */
    private OffsetDateTime completedAt;

    /** Optional — the user who created the task, if known. */
    private Long createdById;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getMilestoneId() {
        return milestoneId;
    }

    public void setMilestoneId(Long milestoneId) {
        this.milestoneId = milestoneId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public void setEstimatedHours(BigDecimal estimatedHours) {
        this.estimatedHours = estimatedHours;
    }

    public BigDecimal getProgress() {
        return progress;
    }

    public void setProgress(BigDecimal progress) {
        this.progress = progress;
    }

    public OffsetDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(OffsetDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public Long getCreatedById() {
        return createdById;
    }

    public void setCreatedById(Long createdById) {
        this.createdById = createdById;
    }
}
