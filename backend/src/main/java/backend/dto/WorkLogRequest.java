package backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public class WorkLogRequest {

    @NotNull
    private Long taskId;

    @NotNull
    private LocalDate workDate;

    // One entry is at most a day (24h) and at least 0.01h; the table's own
    // CHECK is only hours_worked > 0.
    @NotNull
    @DecimalMin(value = "0.01", message = "Hours must be greater than 0")
    @DecimalMax(value = "24.00", message = "A single entry cannot exceed 24 hours")
    private BigDecimal hoursWorked;

    @Size(max = 500)
    private String description;

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public void setWorkDate(LocalDate workDate) {
        this.workDate = workDate;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public void setHoursWorked(BigDecimal hoursWorked) {
        this.hoursWorked = hoursWorked;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
