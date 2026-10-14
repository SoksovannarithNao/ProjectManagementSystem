package backend.service;

import backend.entity.Comment;
import backend.entity.Milestone;
import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.repository.NotificationRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.util.TextFormat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// "Something changed around you" notifications: a comment or reply on a task, a task's status,
// an edit to a project, an edit to a milestone (brief B9; recipients proposed as D-10).
//
// Recipients, in every case: the people with work on the item (a task's assignees, the
// assignees of a project's tasks, the assignees of a milestone's tasks) plus the project's
// Owner and Team Leaders, minus the person who made the change. A reply also reaches the
// author of the comment it answers. People with task notifications switched off, and
// accounts that are not ACTIVE, are skipped. Called by the services right after the change
// is saved, like NotificationService (ADR-0007).
@Service
@Transactional
public class UpdateNotificationService {

    static final String COMMENT_ADDED = "COMMENT_ADDED";
    static final String MENTION = "MENTION";
    static final String TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED";
    static final String PROJECT_UPDATED = "PROJECT_UPDATED";
    static final String MILESTONE_UPDATED = "MILESTONE_UPDATED";

    private static final int MAX_MESSAGE = 500;
    private static final int COMMENT_PREVIEW = 100;

    private final NotificationRepository notificationRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final TaskRepository taskRepository;

    public UpdateNotificationService(
            NotificationRepository notificationRepository,
            ProjectMemberRepository projectMemberRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            TaskRepository taskRepository) {
        this.notificationRepository = notificationRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.taskRepository = taskRepository;
    }

    /** A comment or reply was added to a task; returns how many notifications were created. */
    public int notifyCommentAdded(Comment comment, User author) {
        return notifyCommentAdded(comment, author, Set.of());
    }

    /**
     * Same, but never to the people in {@code alreadyNotified} (those @mentioned in the comment were
     * told by {@link #notifyMentioned} and do not get a second notification for the same comment).
     */
    public int notifyCommentAdded(Comment comment, User author, Set<Long> alreadyNotified) {
        Task task = comment.getTask();
        Project project = task.getProject();
        boolean reply = comment.getParentComment() != null;

        List<User> recipients = new ArrayList<>();
        taskAssigneeRepository.findByTaskId(task.getId()).forEach(a -> recipients.add(a.getUser()));
        recipients.addAll(leaders(project));
        if (reply) {
            recipients.add(comment.getParentComment().getUser());
        }

        recipients.removeIf(user -> user != null && alreadyNotified.contains(user.getId()));

        String message = author.getFullName() + (reply ? " replied on \"" : " commented on \"") + task.getTitle()
                + "\" in \"" + project.getName() + "\": " + TextFormat.shorten(comment.getMessage(), COMMENT_PREVIEW);
        return deliver(COMMENT_ADDED, reply ? "New reply" : "New comment", message, project, task, recipients, author);
    }

    /** People @mentioned in a comment (or newly mentioned by an edit); returns how many were told. */
    public int notifyMentioned(Comment comment, User author, Collection<User> mentioned) {
        if (mentioned.isEmpty()) {
            return 0;
        }
        Task task = comment.getTask();
        Project project = task.getProject();
        String message = author.getFullName() + " mentioned you on \"" + task.getTitle() + "\" in \""
                + project.getName() + "\": " + TextFormat.shorten(comment.getMessage(), COMMENT_PREVIEW);
        return deliver(MENTION, "You were mentioned", message, project, task, mentioned, author);
    }

    /** A task moved to another status (the task already holds the new one); returns how many were told. */
    public int notifyTaskStatusChanged(Task task, User actor) {
        List<User> recipients = new ArrayList<>();
        taskAssigneeRepository.findByTaskId(task.getId()).forEach(a -> recipients.add(a.getUser()));
        recipients.addAll(leaders(task.getProject()));

        String message = "\"" + task.getTitle() + "\" is now " + TextFormat.humanizeEnum(task.getStatus());
        return deliver(TASK_STATUS_CHANGED, "Task status updated", message, task.getProject(), task, recipients, actor);
    }

    /** A project was edited ({@code changed} names the fields) or completed. */
    public int notifyProjectUpdated(Project project, User actor, boolean completed, List<String> changed) {
        List<User> recipients = new ArrayList<>();
        taskAssigneeRepository.findByTask_ProjectIdIn(List.of(project.getId()))
                .forEach(a -> recipients.add(a.getUser()));
        recipients.addAll(leaders(project));

        String message = completed
                ? actor.getFullName() + " marked \"" + project.getName() + "\" as completed"
                : actor.getFullName() + " updated \"" + project.getName() + "\" (" + String.join(", ", changed) + ")";
        return deliver(PROJECT_UPDATED, completed ? "Project completed" : "Project updated", message, project, null,
                recipients, actor);
    }

    /** A milestone was edited ({@code changed} names the fields) or completed. */
    public int notifyMilestoneUpdated(Milestone milestone, User actor, boolean completed, List<String> changed) {
        Project project = milestone.getProject();
        List<Long> taskIds = taskRepository.findByMilestoneId(milestone.getId()).stream().map(Task::getId).toList();
        List<User> recipients = new ArrayList<>();
        if (!taskIds.isEmpty()) {
            taskAssigneeRepository.findByTaskIdIn(taskIds).stream()
                    .map(TaskAssignee::getUser)
                    .forEach(recipients::add);
        }
        recipients.addAll(leaders(project));

        String message = completed
                ? actor.getFullName() + " completed milestone \"" + milestone.getTitle() + "\" in \"" + project.getName() + "\""
                : actor.getFullName() + " updated milestone \"" + milestone.getTitle() + "\" in \"" + project.getName()
                        + "\" (" + String.join(", ", changed) + ")";
        return deliver(MILESTONE_UPDATED, completed ? "Milestone completed" : "Milestone updated", message, project,
                null, recipients, actor);
    }

    // The project's active Owner and Team Leaders.
    private List<User> leaders(Project project) {
        return projectMemberRepository.findByProjectIdAndStatus(project.getId(), "ACTIVE").stream()
                .filter(m -> "OWNER".equals(m.getProjectRole()) || "ADMIN".equals(m.getProjectRole()))
                .map(ProjectMember::getUser)
                .toList();
    }

    // One notification per person, never to the actor.
    private int deliver(String type, String title, String message, Project project, Task task,
                        Collection<User> recipients, User actor) {
        Map<Long, User> unique = new LinkedHashMap<>();
        for (User user : recipients) {
            if (user == null || user.getId() == null || user.getId().equals(actor.getId())) {
                continue;
            }
            unique.putIfAbsent(user.getId(), user);
        }
        int created = 0;
        for (User user : unique.values()) {
            if (!"ACTIVE".equals(user.getAccountStatus()) || !user.isTaskNotificationsEnabled()) {
                continue;
            }
            Notification notification = new Notification();
            notification.setUser(user);
            notification.setType(type);
            notification.setTitle(title);
            notification.setMessage(TextFormat.shorten(message, MAX_MESSAGE));
            notification.setProject(project);
            notification.setTask(task);
            notificationRepository.save(notification);
            created++;
        }
        return created;
    }
}
