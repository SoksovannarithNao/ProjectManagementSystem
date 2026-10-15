package backend.service;

import backend.dto.CommentRequest;
import backend.dto.CommentResponse;
import backend.entity.ProjectMember;
import backend.entity.Comment;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.CommentRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.Mentions;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional
public class CommentService {

    private final CommentRepository commentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final ActivityLogService activityLogService;
    private final UpdateNotificationService updateNotificationService;
    private final ProjectMemberRepository projectMemberRepository;

    public CommentService(
            CommentRepository commentRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ActivityLogService activityLogService,
            UpdateNotificationService updateNotificationService,
            ProjectMemberRepository projectMemberRepository) {
        this.projectMemberRepository = projectMemberRepository;
        this.commentRepository = commentRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.activityLogService = activityLogService;
        this.updateNotificationService = updateNotificationService;
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        Map<String, User> members = activeMembersByUsername(task.getProject().getId());
        return commentRepository.findByTaskIdOrderByCreatedAtAsc(taskId).stream()
                .map(c -> toResponse(c, members))
                .toList();
    }

    public CommentResponse createComment(CommentRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        // Commenting is a content write — a VIEWER can read the discussion but not add to it.
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.COMMENT, Action.CREATE);
        ProjectWorkRules.assertTaskAcceptsNew(task, "comments");

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
        // Anyone @mentioned is told so (and not a second time by the generic comment notice).
        Map<String, User> members = activeMembersByUsername(task.getProject().getId());
        List<User> mentioned = mentionedIn(saved.getMessage(), members, caller);
        updateNotificationService.notifyMentioned(saved, caller, mentioned);
        updateNotificationService.notifyCommentAdded(saved, caller, idsOf(mentioned));
        return toResponse(saved, members);
    }

    // The active members of the project (with an active account) by lower-case username: the only
    // people an @mention can reach.
    private Map<String, User> activeMembersByUsername(Long projectId) {
        Map<String, User> members = new LinkedHashMap<>();
        for (ProjectMember member : projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE")) {
            User user = member.getUser();
            if ("ACTIVE".equals(user.getAccountStatus())) {
                members.put(user.getUsername().toLowerCase(java.util.Locale.ROOT), user);
            }
        }
        return members;
    }

    // The members mentioned in `message`, never the author.
    private static List<User> mentionedIn(String message, Map<String, User> members, User author) {
        Map<String, String> names = new LinkedHashMap<>();
        members.forEach((lower, user) -> names.put(lower, user.getUsername()));
        List<User> mentioned = new ArrayList<>();
        for (String username : Mentions.resolve(message, names)) {
            User user = members.get(username.toLowerCase(java.util.Locale.ROOT));
            if (user != null && !user.getId().equals(author.getId())) {
                mentioned.add(user);
            }
        }
        return mentioned;
    }

    private static Set<Long> idsOf(List<User> users) {
        Set<Long> ids = new HashSet<>();
        users.forEach(u -> ids.add(u.getId()));
        return ids;
    }

    // The response also names the members the text mentions (the author included: a highlighted
    // @name is still a mention, it just notifies nobody).
    private static CommentResponse toResponse(Comment comment, Map<String, User> members) {
        Map<String, String> names = new LinkedHashMap<>();
        members.forEach((lower, user) -> names.put(lower, user.getUsername()));
        List<CommentResponse.Mention> mentions = Mentions.resolve(comment.getMessage(), names).stream()
                .map(username -> members.get(username.toLowerCase(java.util.Locale.ROOT)))
                .map(user -> new CommentResponse.Mention(user.getId(), user.getUsername(), user.getFullName()))
                .toList();
        return new CommentResponse(comment).withMentions(mentions);
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
        Map<String, User> members = activeMembersByUsername(comment.getTask().getProject().getId());
        Set<Long> alreadyMentioned = idsOf(mentionedIn(comment.getMessage(), members, caller));
        comment.setMessage(request.getMessage());
        Comment saved = commentRepository.save(comment);
        // Editing tells only the people it newly mentions.
        List<User> newlyMentioned = mentionedIn(saved.getMessage(), members, caller).stream()
                .filter(u -> !alreadyMentioned.contains(u.getId()))
                .toList();
        updateNotificationService.notifyMentioned(saved, caller, newlyMentioned);
        return toResponse(saved, members);
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
