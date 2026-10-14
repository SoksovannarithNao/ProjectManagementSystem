package backend.dto;

import backend.entity.Comment;
import java.time.OffsetDateTime;
import java.util.List;

public class CommentResponse {

    private Long id;
    private Long taskId;
    private Long userId;
    private String authorName;
    private Long parentCommentId;
    private String message;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    // The active members of the project that the message mentions with @username.
    private List<Mention> mentions = List.of();

    public record Mention(Long id, String username, String fullName) {
    }

    public CommentResponse(Comment comment) {
        this.id = comment.getId();
        this.taskId = comment.getTask().getId();
        this.userId = comment.getUser().getId();
        this.authorName = comment.getUser().getFullName();
        this.parentCommentId = comment.getParentComment() != null ? comment.getParentComment().getId() : null;
        this.message = comment.getMessage();
        this.createdAt = comment.getCreatedAt();
        this.updatedAt = comment.getUpdatedAt();
    }

    public List<Mention> getMentions() {
        return mentions;
    }

    public CommentResponse withMentions(List<Mention> mentions) {
        this.mentions = mentions;
        return this;
    }

    public Long getId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public Long getUserId() {
        return userId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public Long getParentCommentId() {
        return parentCommentId;
    }

    public String getMessage() {
        return message;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
