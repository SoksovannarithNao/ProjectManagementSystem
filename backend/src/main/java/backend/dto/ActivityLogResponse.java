package backend.dto;

import backend.entity.ActivityLog;
import java.time.OffsetDateTime;

public class ActivityLogResponse {

    private Long id;
    private String action;
    private String description;
    private Long userId;
    private String userName;
    // The task the entry is about, when there is one (project-level events and
    // the record of a deleted task have none).
    private Long taskId;
    private String taskTitle;
    private Long projectId;
    private String projectName;
    private OffsetDateTime createdAt;

    public ActivityLogResponse(ActivityLog activityLog) {
        this.id = activityLog.getId();
        this.action = activityLog.getAction();
        this.description = activityLog.getDescription();
        this.userId = activityLog.getUser() != null ? activityLog.getUser().getId() : null;
        this.userName = activityLog.getUser() != null ? activityLog.getUser().getFullName() : "System";
        this.taskId = activityLog.getTask() != null ? activityLog.getTask().getId() : null;
        this.taskTitle = activityLog.getTask() != null ? activityLog.getTask().getTitle() : null;
        this.projectId = activityLog.getProject() != null ? activityLog.getProject().getId() : null;
        this.projectName = activityLog.getProject() != null ? activityLog.getProject().getName() : null;
        this.createdAt = activityLog.getCreatedAt();
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public Long getId() {
        return id;
    }

    public String getAction() {
        return action;
    }

    public String getDescription() {
        return description;
    }

    public Long getUserId() {
        return userId;
    }

    public String getUserName() {
        return userName;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
