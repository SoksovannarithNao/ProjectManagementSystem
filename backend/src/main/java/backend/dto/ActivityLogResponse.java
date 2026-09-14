package backend.dto;

import backend.entity.ActivityLog;
import java.time.OffsetDateTime;

public class ActivityLogResponse {

    private Long id;
    private String action;
    private String description;
    private Long userId;
    private String userName;
    private OffsetDateTime createdAt;

    public ActivityLogResponse(ActivityLog activityLog) {
        this.id = activityLog.getId();
        this.action = activityLog.getAction();
        this.description = activityLog.getDescription();
        this.userId = activityLog.getUser() != null ? activityLog.getUser().getId() : null;
        this.userName = activityLog.getUser() != null ? activityLog.getUser().getFullName() : "System";
        this.createdAt = activityLog.getCreatedAt();
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

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
