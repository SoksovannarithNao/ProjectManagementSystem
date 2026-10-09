package backend.dto;

import backend.entity.Attachment;

import java.time.OffsetDateTime;

// What the lists show about a file: never its bytes (those come from
// GET /api/attachments/{id}/download).
public class AttachmentResponse {

    private final Long id;
    private final Long taskId;
    private final Long projectId;
    private final String fileName;
    private final String mimeType;
    private final Long fileSize;
    private final Long uploadedById;
    private final String uploadedByName;
    private final OffsetDateTime uploadedAt;

    public AttachmentResponse(Attachment attachment) {
        this.id = attachment.getId();
        this.taskId = attachment.getTask() != null ? attachment.getTask().getId() : null;
        this.projectId = attachment.owningProject().getId();
        this.fileName = attachment.getFileName();
        this.mimeType = attachment.getMimeType();
        this.fileSize = attachment.getFileSize();
        this.uploadedById = attachment.getUploadedBy() != null ? attachment.getUploadedBy().getId() : null;
        this.uploadedByName = attachment.getUploadedBy() != null ? attachment.getUploadedBy().getFullName() : null;
        this.uploadedAt = attachment.getUploadedAt();
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getFileName() {
        return fileName;
    }

    public String getMimeType() {
        return mimeType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public Long getUploadedById() {
        return uploadedById;
    }

    public String getUploadedByName() {
        return uploadedByName;
    }

    public OffsetDateTime getUploadedAt() {
        return uploadedAt;
    }
}
