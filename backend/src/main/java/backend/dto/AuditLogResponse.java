package backend.dto;

import backend.entity.AuditLog;

import java.time.OffsetDateTime;

public class AuditLogResponse {

    private final Long id;
    private final Long actorId;
    private final String actorName;
    private final String action;
    private final String targetType;
    private final Long targetId;
    private final String targetLabel;
    private final Long projectId;
    private final String beforeValue;
    private final String afterValue;
    private final OffsetDateTime createdAt;

    public AuditLogResponse(AuditLog log) {
        this.id = log.getId();
        this.actorId = log.getActorId();
        this.actorName = log.getActorName();
        this.action = log.getAction();
        this.targetType = log.getTargetType();
        this.targetId = log.getTargetId();
        this.targetLabel = log.getTargetLabel();
        this.projectId = log.getProjectId();
        this.beforeValue = log.getBeforeValue();
        this.afterValue = log.getAfterValue();
        this.createdAt = log.getCreatedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getActorId() {
        return actorId;
    }

    public String getActorName() {
        return actorName;
    }

    public String getAction() {
        return action;
    }

    public String getTargetType() {
        return targetType;
    }

    public Long getTargetId() {
        return targetId;
    }

    public String getTargetLabel() {
        return targetLabel;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getBeforeValue() {
        return beforeValue;
    }

    public String getAfterValue() {
        return afterValue;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
