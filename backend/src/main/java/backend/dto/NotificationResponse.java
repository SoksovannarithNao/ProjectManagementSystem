package backend.dto;

import backend.entity.Notification;
import java.time.OffsetDateTime;

// Deliberately not nesting full ProjectResponse/TaskResponse (which would drag
// in each project's manager, etc.) — just enough to label and link the
// notification back to its source.
public class NotificationResponse {

    private final Long id;
    private final String type;
    private final String title;
    private final String message;
    private final Long projectId;
    private final String projectName;
    private final Long taskId;
    private final String taskTitle;
    private final boolean read;
    private final OffsetDateTime createdAt;

    public NotificationResponse(Notification notification) {
        this.id = notification.getId();
        this.type = notification.getType();
        this.title = notification.getTitle();
        this.message = notification.getMessage();
        this.projectId = notification.getProject() != null ? notification.getProject().getId() : null;
        this.projectName = notification.getProject() != null ? notification.getProject().getName() : null;
        this.taskId = notification.getTask() != null ? notification.getTask().getId() : null;
        this.taskTitle = notification.getTask() != null ? notification.getTask().getTitle() : null;
        this.read = notification.isRead();
        this.createdAt = notification.getCreatedAt();
    }

    public Long getId() {
        return id;
    }

    public String getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTaskTitle() {
        return taskTitle;
    }

    public boolean isRead() {
        return read;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
