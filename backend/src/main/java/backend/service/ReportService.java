package backend.service;

import backend.dto.ReportsResponse.*;
import backend.dto.UserResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.Derived;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

// The five KPIs and the seven named reports (assignment-brief.md B8, D-12, D-13;
// workflow flows 31 and 32).
//
// Who may generate (B8): REPORT:GENERATE_REPORTS. An Administrator reports on every
// project; a Project Manager on the projects they belong to; an Owner or Team Leader
// on their own project. Everyone else is refused (403) - the permission is checked
// here, on the server, not only by hiding the page. A report contains only the
// projects and tasks the caller may report on, and a project outside that set is
// refused even if its id is guessed.
//
// Everything is calculated here from the same statuses and dates as the dashboard
// (util/Derived), so every client shows the same numbers. Cancelled tasks are not
// remaining work and are left out of the rates (B1.5).
@Service
@Transactional(readOnly = true)
public class ReportService {

    private static final Set<String> TASK_STATUSES = Set.of("TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED");
    private static final Set<String> PROJECT_STATUSES = Set.of("PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
    private static final int UPCOMING_DAYS = 14;
    private static final int UPCOMING_LIMIT = 10;

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final MilestoneRepository milestoneRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final TeamViewsService teamViewsService;

    public ReportService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            MilestoneRepository milestoneRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            TeamViewsService teamViewsService) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.milestoneRepository = milestoneRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.teamViewsService = teamViewsService;
    }

    // ------------------------------------------------------------------ scope

    // The projects (and their tasks) one report is about.
    private record Context(User caller, Long projectId, String projectName, List<Project> projects, List<Task> tasks,
                           Map<Long, List<User>> assignees, LocalDate today) {
        List<Long> projectIds() {
            return projects.stream().map(Project::getId).toList();
        }

        List<User> assigneesOf(Task task) {
            return assignees.getOrDefault(task.getId(), List.of());
        }
    }

    private Context context(String username, Long projectId, LocalDate today) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        List<Project> reportable = reportableProjects(caller);
        if (!projectAccessGuard.isAdmin(caller) && reportable.isEmpty()) {
            throw new AccessDeniedException("You do not have permission to generate reports");
        }
        List<Project> projects = reportable;
        String projectName = null;
        if (projectId != null) {
            Project project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new NotFoundException("Project not found"));
            projectAccessGuard.assertAccess(caller, projectId);
            if (reportable.stream().noneMatch(p -> p.getId().equals(projectId))) {
                throw new AccessDeniedException("You do not have permission to generate reports for this project");
            }
            projects = List.of(project);
            projectName = project.getName();
        }
        List<Long> ids = projects.stream().map(Project::getId).toList();
        List<Task> tasks = ids.isEmpty() ? List.of() : taskRepository.findByProjectIdIn(ids);
        Map<Long, List<User>> assignees = new HashMap<>();
        if (!ids.isEmpty()) {
            for (TaskAssignee ta : taskAssigneeRepository.findByTask_ProjectIdIn(ids)) {
                assignees.computeIfAbsent(ta.getTask().getId(), k -> new ArrayList<>()).add(ta.getUser());
            }
        }
        return new Context(caller, projectId, projectName, projects, tasks, assignees, today);
    }

    // Administrator: every project. Otherwise the projects the caller is an active
    // member of where REPORT:GENERATE_REPORTS applies (through the Project Manager
    // system role, or the Owner / Team Leader role in that project).
    private List<Project> reportableProjects(User caller) {
        if (projectAccessGuard.isAdmin(caller)) {
            return projectRepository.findAll();
        }
        List<Long> ids = projectMemberRepository.findProjectIdsByUserId(caller.getId()).stream()
                .filter(id -> projectAccessGuard.can(caller, id, Resource.REPORT, Action.GENERATE_REPORTS))
                .toList();
        return ids.isEmpty() ? List.of() : projectRepository.findByIdIn(ids);
    }

    private static Scope scope(Context c, LocalDate from, LocalDate to) {
        return new Scope(c.projectId(), c.projectName(), c.projects().size(), from, to, OffsetDateTime.now());
    }

    // ------------------------------------------------------------------ KPIs

    public Kpis getKpis(String username, Long projectId) {
        return getKpis(username, projectId, LocalDate.now());
    }

    Kpis getKpis(String username, Long projectId, LocalDate today) {
        Context c = context(username, projectId, today);
        long projects = c.projects().size();
        long completedProjects = c.projects().stream().filter(p -> "COMPLETED".equals(p.getStatus())).count();
        long cancelledProjects = c.projects().stream().filter(p -> "CANCELLED".equals(p.getStatus())).count();

        List<Task> tasks = c.tasks();
        List<Task> completed = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).toList();
        long cancelledTasks = tasks.stream().filter(t -> "CANCELLED".equals(t.getStatus())).count();
        long overdue = tasks.stream().filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today)).count();
        long onTime = completed.stream().filter(ReportService::completedOnTime).count();

        List<Long> days = completed.stream()
                .filter(t -> t.getCompletedAt() != null && t.getStartDate() != null)
                .map(t -> Math.max(0, ChronoUnit.DAYS.between(t.getStartDate(), t.getCompletedAt().toLocalDate())))
                .toList();
        BigDecimal averageDays = days.isEmpty() ? null
                : BigDecimal.valueOf(days.stream().mapToLong(Long::longValue).sum())
                        .divide(BigDecimal.valueOf(days.size()), 1, RoundingMode.HALF_UP);

        Basis basis = new Basis(projects, completedProjects, cancelledProjects, tasks.size(), completed.size(),
                cancelledTasks, overdue, onTime);
        return new Kpis(scope(c, null, null),
                percent(completedProjects, projects - cancelledProjects),
                percent(completed.size(), tasks.size() - cancelledTasks),
                percent(overdue, tasks.size() - completed.size() - cancelledTasks),
                averageDays,
                percent(onTime, completed.size()),
                basis);
    }

    // On or before the due date; a task with no completion time cannot be judged.
    private static boolean completedOnTime(Task t) {
        return t.getCompletedAt() != null && t.getDueDate() != null && !t.getCompletedAt().toLocalDate().isAfter(t.getDueDate());
    }

    // ------------------------------------------------------------------ 1. Project Report

    public ProjectReport getProjectReport(String username, Long projectId) {
        return getProjectReport(username, projectId, LocalDate.now());
    }

    ProjectReport getProjectReport(String username, Long projectId, LocalDate today) {
        if (projectId == null) {
            throw new IllegalArgumentException("Choose the project for the Project Report");
        }
        Context c = context(username, projectId, today);
        Project project = c.projects().get(0);
        List<TeamMember> team = projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE").stream()
                .sorted(Comparator.comparing((ProjectMember m) -> m.getUser().getFullName()))
                .map(m -> new TeamMember(new UserResponse(m.getUser()), m.getProjectRole()))
                .toList();
        List<MilestoneRow> milestones = milestoneRepository.findByProjectId(projectId).stream()
                .sorted(Comparator.comparing(Milestone::getDueDate))
                .map(m -> new MilestoneRow(m.getId(), m.getTitle(), m.getDueDate(), m.getStatus(), m.getProgress()))
                .toList();
        LocalDate horizon = today.plusDays(UPCOMING_DAYS);
        List<TaskRow> upcoming = c.tasks().stream()
                .filter(t -> !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus()))
                .filter(t -> t.getDueDate() != null && !t.getDueDate().isAfter(horizon))
                .sorted(Comparator.comparing(Task::getDueDate))
                .limit(UPCOMING_LIMIT)
                .map(t -> row(c, t))
                .toList();
        return new ProjectReport(scope(c, null, null), projectRow(project, today), project.getDescription(), team,
                milestones, counts(c.tasks(), today), upcoming);
    }

    // ------------------------------------------------------------------ 2. Task Report

    public TaskReport getTaskReport(String username, Long projectId, Long assigneeId, String status, String priority,
                                    LocalDate dueFrom, LocalDate dueTo) {
        return getTaskReport(username, projectId, assigneeId, status, priority, dueFrom, dueTo, LocalDate.now());
    }

    TaskReport getTaskReport(String username, Long projectId, Long assigneeId, String status, String priority,
                             LocalDate dueFrom, LocalDate dueTo, LocalDate today) {
        requireOneOf(status, TASK_STATUSES, "status");
        requireOneOf(priority, PRIORITIES, "priority");
        requireOrderedRange(dueFrom, dueTo);
        Context c = context(username, projectId, today);
        List<TaskRow> rows = c.tasks().stream()
                .filter(t -> status == null || status.equals(t.getStatus()))
                .filter(t -> priority == null || priority.equals(t.getPriority()))
                .filter(t -> assigneeId == null || hasAssignee(c, t, assigneeId))
                .filter(t -> inRange(t.getDueDate(), dueFrom, dueTo))
                .sorted(Comparator.comparing(Task::getDueDate).thenComparing(Task::getTitle))
                .map(t -> row(c, t))
                .toList();
        return new TaskReport(scope(c, dueFrom, dueTo), rows);
    }

    // ------------------------------------------------------------------ 3. Project Status Report

    public ProjectStatusReport getProjectStatusReport(String username, String status, Long ownerId, LocalDate from,
                                                      LocalDate to) {
        return getProjectStatusReport(username, status, ownerId, from, to, LocalDate.now());
    }

    ProjectStatusReport getProjectStatusReport(String username, String status, Long ownerId, LocalDate from,
                                               LocalDate to, LocalDate today) {
        if (status != null && !"DELAYED".equals(status)) {
            requireOneOf(status, PROJECT_STATUSES, "status");
        }
        requireOrderedRange(from, to);
        Context c = context(username, null, today);
        // A project is in the range when its start-to-end period overlaps it.
        List<Project> projects = c.projects().stream()
                .filter(p -> ownerId == null || (p.getManager() != null && ownerId.equals(p.getManager().getId())))
                .filter(p -> overlaps(p.getStartDate(), p.getEndDate(), from, to))
                .sorted(Comparator.comparing(Project::getName))
                .toList();

        String[][] groups = {
                {"PLANNING", "Planning"}, {"IN_PROGRESS", "In Progress"}, {"ON_HOLD", "On Hold"},
                {"COMPLETED", "Completed"}, {"CANCELLED", "Cancelled"}, {"DELAYED", "Delayed"}};
        List<StatusGroup> result = new ArrayList<>();
        for (String[] g : groups) {
            if (status != null && !status.equals(g[0])) {
                continue;
            }
            List<ProjectRow> rows = projects.stream()
                    .filter(p -> "DELAYED".equals(g[0])
                            ? Derived.isProjectDelayed(p.getStatus(), p.getEndDate(), today)
                            : g[0].equals(p.getStatus()))
                    .map(p -> projectRow(p, today))
                    .toList();
            result.add(new StatusGroup(g[0], g[1], rows.size(), rows));
        }
        return new ProjectStatusReport(scope(c, from, to), result);
    }

    // ------------------------------------------------------------------ 4. Task Completion Report

    // The scope is the non-cancelled tasks due in the range; the percentage is how many of
    // them are Completed. Grouped by project, by member (a task counts for each of its
    // assignees; "Unassigned" for none) or by the month the task is due.
    public TaskCompletionReport getTaskCompletionReport(String username, Long projectId, String groupBy, LocalDate from,
                                                        LocalDate to) {
        return getTaskCompletionReport(username, projectId, groupBy, from, to, LocalDate.now());
    }

    TaskCompletionReport getTaskCompletionReport(String username, Long projectId, String groupBy, LocalDate from,
                                                 LocalDate to, LocalDate today) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("Choose the date range (from and to) for the Task Completion Report");
        }
        requireOrderedRange(from, to);
        String by = groupBy == null ? "project" : groupBy;
        if (!Set.of("project", "member", "month").contains(by)) {
            throw new IllegalArgumentException("groupBy must be project, member or month");
        }
        Context c = context(username, projectId, today);
        List<Task> scoped = c.tasks().stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .filter(t -> inRange(t.getDueDate(), from, to))
                .toList();

        // key -> label, kept in a stable order
        Map<String, String> labels = new TreeMap<>();
        Map<String, List<Task>> grouped = new LinkedHashMap<>();
        for (Task t : scoped) {
            switch (by) {
                case "project" -> add(grouped, labels, String.valueOf(t.getProject().getId()), t.getProject().getName(), t);
                case "month" -> {
                    String key = t.getDueDate().getYear() + "-" + String.format("%02d", t.getDueDate().getMonthValue());
                    add(grouped, labels, key, key, t);
                }
                default -> {
                    List<User> people = c.assigneesOf(t);
                    if (people.isEmpty()) {
                        add(grouped, labels, "0", "Unassigned", t);
                    }
                    for (User u : people) {
                        add(grouped, labels, String.valueOf(u.getId()), u.getFullName(), t);
                    }
                }
            }
        }
        List<CompletionGroup> groups = grouped.entrySet().stream()
                .map(e -> completionGroup(e.getKey(), labels.get(e.getKey()), e.getValue()))
                .sorted(Comparator.comparing(CompletionGroup::label))
                .toList();
        List<TaskRow> completedTasks = scoped.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus()))
                .sorted(Comparator.comparing(Task::getDueDate))
                .map(t -> row(c, t))
                .toList();
        return new TaskCompletionReport(scope(c, from, to), by, completionGroup("all", "All", scoped), groups,
                completedTasks);
    }

    private static void add(Map<String, List<Task>> grouped, Map<String, String> labels, String key, String label, Task t) {
        labels.putIfAbsent(key, label);
        grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
    }

    private static CompletionGroup completionGroup(String key, String label, List<Task> tasks) {
        long done = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
        return new CompletionGroup(key, label, tasks.size(), done, percent(done, tasks.size()));
    }

    // ------------------------------------------------------------------ 5. Overdue Task Report

    public OverdueReport getOverdueReport(String username, Long projectId, Long assigneeId, String priority) {
        return getOverdueReport(username, projectId, assigneeId, priority, LocalDate.now());
    }

    OverdueReport getOverdueReport(String username, Long projectId, Long assigneeId, String priority, LocalDate today) {
        requireOneOf(priority, PRIORITIES, "priority");
        Context c = context(username, projectId, today);
        List<TaskRow> rows = c.tasks().stream()
                .filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today))
                .filter(t -> priority == null || priority.equals(t.getPriority()))
                .filter(t -> assigneeId == null || hasAssignee(c, t, assigneeId))
                .map(t -> row(c, t))
                .sorted(Comparator.comparingLong(TaskRow::daysOverdue).reversed().thenComparing(TaskRow::title))
                .toList();
        return new OverdueReport(scope(c, null, null), rows);
    }

    // ------------------------------------------------------------------ 6. Team Performance Report

    public TeamPerformanceReport getTeamPerformanceReport(String username, Long projectId, LocalDate from, LocalDate to) {
        return getTeamPerformanceReport(username, projectId, from, to, LocalDate.now());
    }

    TeamPerformanceReport getTeamPerformanceReport(String username, Long projectId, LocalDate from, LocalDate to,
                                                   LocalDate today) {
        requireOrderedRange(from, to);
        Context c = context(username, projectId, today);
        Map<Long, List<Task>> byPerson = new LinkedHashMap<>();
        Map<Long, User> people = new HashMap<>();
        for (Task t : c.tasks()) {
            if ("CANCELLED".equals(t.getStatus()) || !inRange(t.getDueDate(), from, to)) {
                continue;
            }
            for (User u : c.assigneesOf(t)) {
                people.putIfAbsent(u.getId(), u);
                byPerson.computeIfAbsent(u.getId(), k -> new ArrayList<>()).add(t);
            }
        }
        List<MemberPerformance> members = byPerson.entrySet().stream()
                .map(e -> {
                    List<Task> mine = e.getValue();
                    long completed = countStatus(mine, "COMPLETED");
                    return new MemberPerformance(new UserResponse(people.get(e.getKey())), mine.size(), completed,
                            countStatus(mine, "TODO"), countStatus(mine, "IN_PROGRESS"), countStatus(mine, "IN_REVIEW"),
                            mine.stream().filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today)).count(),
                            percent(completed, mine.size()));
                })
                .sorted(Comparator.comparing((MemberPerformance m) -> m.user().getFullName()))
                .toList();
        return new TeamPerformanceReport(scope(c, from, to), members);
    }

    // ------------------------------------------------------------------ 7. Workload Report

    public WorkloadReport getWorkloadReport(String username, Long projectId) {
        return getWorkloadReport(username, projectId, LocalDate.now());
    }

    WorkloadReport getWorkloadReport(String username, Long projectId, LocalDate today) {
        Context c = context(username, projectId, today);
        return new WorkloadReport(scope(c, null, null),
                teamViewsService.buildWorkload(c.projectIds(), projectId, c.projectName(), today));
    }

    // ------------------------------------------------------------------ helpers

    private TaskRow row(Context c, Task t) {
        List<String> names = c.assigneesOf(t).stream().map(User::getFullName).sorted().toList();
        return new TaskRow(t.getId(), t.getTitle(), t.getProject().getId(), t.getProject().getName(), names,
                t.getPriority(), t.getStatus(), t.getProgress(), t.getStartDate(), t.getDueDate(), t.getEstimatedHours(),
                t.getCompletedAt(),
                Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), c.today()) ? Derived.daysLate(t.getDueDate(), c.today()) : 0);
    }

    private static ProjectRow projectRow(Project p, LocalDate today) {
        boolean delayed = Derived.isProjectDelayed(p.getStatus(), p.getEndDate(), today);
        return new ProjectRow(p.getId(), p.getProjectCode(), p.getName(), p.getStatus(), p.getPriority(),
                p.getManager() != null ? new UserResponse(p.getManager()) : null, p.getStartDate(), p.getEndDate(),
                p.getProgress(), delayed, delayed ? Derived.daysLate(p.getEndDate(), today) : 0);
    }

    private static TaskCounts counts(List<Task> tasks, LocalDate today) {
        return new TaskCounts(tasks.size(), countStatus(tasks, "TODO"), countStatus(tasks, "IN_PROGRESS"),
                countStatus(tasks, "IN_REVIEW"), countStatus(tasks, "COMPLETED"), countStatus(tasks, "CANCELLED"),
                tasks.stream().filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today)).count());
    }

    private static long countStatus(List<Task> tasks, String status) {
        return tasks.stream().filter(t -> status.equals(t.getStatus())).count();
    }

    private static boolean hasAssignee(Context c, Task t, Long userId) {
        return c.assigneesOf(t).stream().anyMatch(u -> u.getId().equals(userId));
    }

    private static boolean inRange(LocalDate date, LocalDate from, LocalDate to) {
        if (date == null) {
            return from == null && to == null;
        }
        return (from == null || !date.isBefore(from)) && (to == null || !date.isAfter(to));
    }

    private static boolean overlaps(LocalDate start, LocalDate end, LocalDate from, LocalDate to) {
        boolean beforeRange = to != null && start != null && start.isAfter(to);
        boolean afterRange = from != null && end != null && end.isBefore(from);
        return !beforeRange && !afterRange;
    }

    // part / whole as 0-100 with one decimal; null when there is nothing to divide by.
    private static BigDecimal percent(long part, long whole) {
        if (whole <= 0) {
            return null;
        }
        return BigDecimal.valueOf(part * 100.0 / whole).setScale(1, RoundingMode.HALF_UP);
    }

    private static void requireOneOf(String value, Set<String> allowed, String name) {
        if (value != null && !allowed.contains(value)) {
            throw new IllegalArgumentException("Unknown " + name + ": " + value);
        }
    }

    private static void requireOrderedRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new IllegalArgumentException("The end of the date range is before its start");
        }
    }
}
