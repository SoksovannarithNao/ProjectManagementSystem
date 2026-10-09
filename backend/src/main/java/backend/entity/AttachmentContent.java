package backend.entity;

import jakarta.persistence.*;

// The bytes of one attachment, kept in the database (like profile photos) so a
// pg_dump carries the files with it. One row per Attachment, same id.
@Entity
@Table(name = "attachment_contents")
public class AttachmentContent {

    @Id
    @Column(name = "attachment_id")
    private Long attachmentId;

    @Column(nullable = false)
    private byte[] data;

    protected AttachmentContent() {
    }

    public AttachmentContent(Long attachmentId, byte[] data) {
        this.attachmentId = attachmentId;
        this.data = data;
    }

    public Long getAttachmentId() {
        return attachmentId;
    }

    public byte[] getData() {
        return data;
    }
}
