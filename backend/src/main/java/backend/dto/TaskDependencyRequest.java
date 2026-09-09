package backend.dto;

import jakarta.validation.constraints.NotNull;

public class TaskDependencyRequest {

    @NotNull
    private Long taskId;

    @NotNull
    private Long dependsOnTaskId;

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public Long getDependsOnTaskId() {
        return dependsOnTaskId;
    }

    public void setDependsOnTaskId(Long dependsOnTaskId) {
        this.dependsOnTaskId = dependsOnTaskId;
    }
}
