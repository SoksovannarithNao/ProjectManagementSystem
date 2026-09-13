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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@Transactional
public class CommentService {

    // Roles allowed to delete another member's comment (moderation), mirroring
    // TaskService.TASK_FULL_EDIT_ROLES — editing someone else's comment text
    // is never allowed, only deleting it.
    private static final Set<String> COMMENT_MODERATION_ROLES =
            Set.of("ADMINISTRATOR", "PROJECT_MANAGER", "TEAM_LEADER");

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public CommentService(
            CommentRepository commentRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
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
        projectAccessGuard.assertAccess(caller, task.getProject().getId());

        Comment comment = new Comment();
        comment.setTask(task);
        comment.setUser(caller);
        comment.setMessage(request.getMessage());
        if (request.getParentCommentId() != null) {
            Comment parent = commentRepository.findById(request.getParentCommentId())
                    .orElseThrow(() -> new NotFoundException("Parent comment not found"));
            comment.setParentComment(parent);
        }
        return new CommentResponse(commentRepository.save(comment));
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
        boolean isModerator = COMMENT_MODERATION_ROLES.contains(caller.getRole().getName())
                && projectAccessGuard.hasAccess(caller, comment.getTask().getProject().getId());
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
