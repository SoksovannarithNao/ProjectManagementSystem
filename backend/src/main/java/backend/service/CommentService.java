package backend.service;

import backend.dto.CommentRequest;
import backend.dto.CommentResponse;
import backend.entity.Comment;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.CommentRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class CommentService {

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final ActivityLogService activityLogService;

    public CommentService(
            CommentRepository commentRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ActivityLogService activityLogService) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId).stream().map(CommentResponse::new).toList();
    }

    public CommentResponse createComment(CommentRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        // Commenting is a content write — a VIEWER can read the discussion but not add to it.
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.COMMENT, Action.CREATE);

        Comment comment = new Comment();
        comment.setTask(task);
        comment.setUser(caller);
        comment.setMessage(request.getMessage());
        if (request.getParentCommentId() != null) {
            Comment parent = commentRepository.findById(request.getParentCommentId())
                    .orElseThrow(() -> new NotFoundException("Parent comment not found"));
            // A reply stays in the discussion of its own task.
            if (!parent.getTask().getId().equals(task.getId())) {
                throw new IllegalArgumentException("The comment you are replying to belongs to another task");
            }
            comment.setParentComment(parent);
        }
        Comment saved = commentRepository.save(comment);
        activityLogService.record(caller, task, "COMMENT_ADDED",
                (saved.getParentComment() != null ? "Reply added: \"" : "Comment added: \"") + preview(saved.getMessage()) + "\"");
        return new CommentResponse(saved);
    }

    // A comment can be long; the activity feed shows only its start.
    private static String preview(String message) {
        String oneLine = message.replaceAll("\\s+", " ").trim();
        return oneLine.length() <= 80 ? oneLine : oneLine.substring(0, 79) + "…";
    }

    // Editing is author-only — even a Team Admin/Administrator can't rewrite
    // someone else's comment, only delete it (see deleteComment).
    public CommentResponse updateComment(Long id, CommentRequest request, String username) {
        User caller = requireUser(username);
        Comment comment = requireComment(id);
        if (!comment.getUser().getId().equals(caller.getId())) {
            throw new AccessDeniedException("You can only edit your own comments");
        }
        comment.setMessage(request.getMessage());
        return new CommentResponse(commentRepository.save(comment));
    }

    public void deleteComment(Long id, String username) {
        User caller = requireUser(username);
        Comment comment = requireComment(id);

        boolean isAuthor = comment.getUser().getId().equals(caller.getId());
        boolean isModerator = projectAccessGuard.can(caller, comment.getTask().getProject().getId(), Resource.COMMENT, Action.DELETE);
        if (!isAuthor && !isModerator) {
            throw new AccessDeniedException("You do not have permission to delete this comment");
        }
        commentRepository.delete(comment);
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private Comment requireComment(Long id) {
        return commentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Comment not found"));
    }
}
