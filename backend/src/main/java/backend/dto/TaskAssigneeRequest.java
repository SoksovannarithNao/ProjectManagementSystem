package backend.dto;

import jakarta.validation.constraints.NotNull;

public class TaskAssigneeRequest {

    @NotNull
    private Long taskId;

    @NotNull
    private Long userId;

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
}
