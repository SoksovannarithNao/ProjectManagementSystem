package backend.dto;

import backend.entity.TaskAssignee;

import java.time.OffsetDateTime;

public class TaskAssigneeResponse {

    private Long id;
    private TaskResponse task;
    private UserResponse user;
    private OffsetDateTime assignedAt;

    public TaskAssigneeResponse(TaskAssignee taskAssignee) {
        this.id = taskAssignee.getId();
        this.task = new TaskResponse(taskAssignee.getTask());
        this.user = new UserResponse(taskAssignee.getUser());
        this.assignedAt = taskAssignee.getAssignedAt();
    }

    public Long getId() {
        return id;
    }

    public TaskResponse getTask() {
        return task;
    }

    public UserResponse getUser() {
        return user;
    }

    public OffsetDateTime getAssignedAt() {
        return assignedAt;
    }
}
