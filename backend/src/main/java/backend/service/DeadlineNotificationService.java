package backend.service;

import backend.entity.Milestone;
import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.repository.MilestoneRepository;
import backend.repository.NotificationRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Deadline reminders and overdue notices (brief B9, workflow §27 and §28).
// Run once a day by DeadlineScheduler; safe to run again at any time, because a
// notification with the same text for the same person and item is never created
// twice (so a restart, or a second run on the same day, adds nothing).
//
// - Reminders: 3 days and 1 day before the due date of an open task or milestone
//   and before the end date of an open project. A missed day is not made up
//   later (a "due in 3 days" notice on the day before would be wrong).
// - Overdue: an open task whose due date has passed, once per person and due date.
// - Recipients: the task's assignees and the project's active Owner (milestones
//   and projects: the Owner). People with task notifications switched off, and
//   accounts that are not ACTIVE, are skipped.
@Service
@Transactional
public class DeadlineNotificationService {

    static final String DEADLINE_REMINDER = "DEADLINE_REMINDER";
    static final String OVERDUE_TASK = "OVERDUE_TASK";
    static final List<Integer> REMINDER_DAYS = List.of(3, 1);

    private static final List<String> FINISHED_TASK_STATUSES = List.of("COMPLETED", "CANCELLED");
    private static final List<String> FINISHED_PROJECT_STATUSES = List.of("COMPLETED", "CANCELLED");

    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final MilestoneRepository milestoneRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final NotificationRepository notificationRepository;

    public DeadlineNotificationService(
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            MilestoneRepository milestoneRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            NotificationRepository notificationRepository) {
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.milestoneRepository = milestoneRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.notificationRepository = notificationRepository;
    }

    /** Creates every reminder and overdue notice that is due on {@code today}; returns how many were created. */
    public int notifyDeadlines(LocalDate today) {
        return sendReminders(today) + sendOverdueNotices(today);
    }

    public int sendReminders(LocalDate today) {
        List<LocalDate> dates = REMINDER_DAYS.stream().map(today::plusDays).toList();
        int created = 0;

        List<Task> tasks = taskRepository.findByDueDateInAndStatusNotIn(dates, FINISHED_TASK_STATUSES);
        Map<Long, List<User>> assignees = assigneesOf(tasks);
        for (Task task : tasks) {
            String message = "\"" + task.getTitle() + "\" in \"" + task.getProject().getName() + "\" is due "
                    + when(today, task.getDueDate());
            created += notifyTask(DEADLINE_REMINDER, "Deadline approaching", message, task,
                    recipients(assignees.get(task.getId()), task.getProject()));
        }

        for (Milestone milestone : milestoneRepository.findByDueDateInAndStatusNot(dates, "COMPLETED")) {
            Project project = milestone.getProject();
            String message = "Milestone \"" + milestone.getTitle() + "\" in \"" + project.getName() + "\" is due "
                    + when(today, milestone.getDueDate());
            created += notifyProject(DEADLINE_REMINDER, "Deadline approaching", message, project,
                    recipients(List.of(), project));
        }

        for (Project project : projectRepository.findByEndDateInAndStatusNotIn(dates, FINISHED_PROJECT_STATUSES)) {
            String message = "Project \"" + project.getName() + "\" ends " + when(today, project.getEndDate());
            created += notifyProject(DEADLINE_REMINDER, "Deadline approaching", message, project,
                    recipients(List.of(), project));
        }
        return created;
    }

    public int sendOverdueNotices(LocalDate today) {
        List<Task> tasks = taskRepository.findByDueDateBeforeAndStatusNotIn(today, FINISHED_TASK_STATUSES);
        Map<Long, List<User>> assignees = assigneesOf(tasks);
        int created = 0;
        for (Task task : tasks) {
            // The text has no "days overdue" so it stays the same from day to day:
            // each person is told once per due date, not every morning.
            String message = "\"" + task.getTitle() + "\" in \"" + task.getProject().getName()
                    + "\" was due on " + task.getDueDate() + " and is not yet completed";
            created += notifyTask(OVERDUE_TASK, "Task overdue", message, task,
                    recipients(assignees.get(task.getId()), task.getProject()));
        }
        return created;
    }

    private static String when(LocalDate today, LocalDate date) {
        long days = ChronoUnit.DAYS.between(today, date);
        return (days == 1 ? "tomorrow" : "in " + days + " days") + " (" + date + ")";
    }

    private Map<Long, List<User>> assigneesOf(List<Task> tasks) {
        Map<Long, List<User>> byTask = new LinkedHashMap<>();
        if (tasks.isEmpty()) {
            return byTask;
        }
        List<Long> ids = tasks.stream().map(Task::getId).toList();
        for (TaskAssignee assignee : taskAssigneeRepository.findByTaskIdIn(ids)) {
            byTask.computeIfAbsent(assignee.getTask().getId(), id -> new ArrayList<>()).add(assignee.getUser());
        }
        return byTask;
    }

    // The assignees plus the project's active Owner, each person once.
    private Collection<User> recipients(List<User> assignees, Project project) {
        Map<Long, User> people = new LinkedHashMap<>();
        if (assignees != null) {
            assignees.forEach(u -> people.put(u.getId(), u));
        }
        projectMemberRepository
                .findFirstByProjectIdAndProjectRoleAndStatus(project.getId(), "OWNER", "ACTIVE")
                .map(ProjectMember::getUser)
                .ifPresent(u -> people.putIfAbsent(u.getId(), u));
        return people.values();
    }

    private int notifyTask(String type, String title, String text, Task task, Collection<User> people) {
        String message = fit(text);
        int created = 0;
        for (User user : people) {
            if (!wantsNotifications(user)
                    || notificationRepository.existsByUserIdAndTypeAndTaskIdAndMessage(user.getId(), type, task.getId(), message)) {
                continue;
            }
            save(user, type, title, message, task.getProject(), task);
            created++;
        }
        return created;
    }

    private int notifyProject(String type, String title, String text, Project project, Collection<User> people) {
        String message = fit(text);
        int created = 0;
        for (User user : people) {
            if (!wantsNotifications(user)
                    || notificationRepository.existsByUserIdAndTypeAndProjectIdAndTaskIsNullAndMessage(
                            user.getId(), type, project.getId(), message)) {
                continue;
            }
            save(user, type, title, message, project, null);
            created++;
        }
        return created;
    }

    // The column holds 500 characters; the same shortened text is what the
    // duplicate check compares, so a very long title cannot defeat it.
    private static String fit(String message) {
        return message.length() <= 500 ? message : message.substring(0, 499) + "\u2026";
    }

    private static boolean wantsNotifications(User user) {
        return "ACTIVE".equals(user.getAccountStatus()) && user.isTaskNotificationsEnabled();
    }

    private void save(User user, String type, String title, String message, Project project, Task task) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setProject(project);
        notification.setTask(task);
        notificationRepository.save(notification);
    }
}
