package backend.util;

import backend.entity.Task;
import backend.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// Search, filter and sort of the task list (assignment-brief.md B1.9, B7.2). Like
// ProjectListQuery it only narrows or reorders the tasks it is given - those the caller may
// already see - so a query can never reveal a task the caller cannot open. Filters combine with
// AND; several values of one filter (status, priority) combine with OR. A query with no
// parameter returns the list unchanged.
public final class TaskListQuery {

    private static final Set<String> STATUSES = Set.of("TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
    private static final Set<String> DUE_FILTERS = Set.of("overdue", "today", "week", "none");
    // The quick views of the task screen; "all" (or no view) leaves the list as the other filters left it.
    public static final List<String> VIEWS = List.of("all", "today", "upcoming", "inprogress", "completed", "overdue");
    private static final Map<String, Integer> PRIORITY_RANK = Map.of("URGENT", 0, "HIGH", 1, "MEDIUM", 2, "LOW", 3);
    private static final Map<String, Integer> STATUS_RANK =
            Map.of("TODO", 0, "IN_PROGRESS", 1, "IN_REVIEW", 2, "COMPLETED", 3, "CANCELLED", 4);
    private static final Map<String, Comparator<Task>> SORTS = Map.of(
            "latest", Comparator.comparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.<OffsetDateTime>naturalOrder().reversed())),
            "dueDate", Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())),
            "priority", Comparator.comparing(t -> PRIORITY_RANK.getOrDefault(t.getPriority(), 9)),
            "progress", Comparator.comparing((Task t) -> t.getProgress() == null ? BigDecimal.ZERO : t.getProgress()).reversed(),
            "status", Comparator.comparing(t -> STATUS_RANK.getOrDefault(t.getStatus(), 9)),
            "title", Comparator.comparing(Task::getTitle, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
    // Projects that are fully done sink below those that still need tracking; then by name.
    private static final Comparator<Task> BY_PROJECT = Comparator
            .comparing((Task t) -> t.getProject().getProgress() != null
                    && t.getProject().getProgress().compareTo(new BigDecimal("100")) >= 0 ? 1 : 0)
            .thenComparing(t -> t.getProject().getName(), Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
            .thenComparing(t -> t.getProject().getId());

    private final String search;
    private final List<String> statuses;
    private final List<String> priorities;
    private final List<Long> assigneeIds;
    private final boolean unassigned;
    private final Long projectId;
    private final String due;
    private final String view;
    private final boolean groupByProject;
    private final String sort;
    // The calendar window: tasks whose due date lies in [dueFrom, dueTo] (either end may be open);
    // a task with no due date is then left out. Set by dueBetween().
    private LocalDate dueFrom;
    private LocalDate dueTo;
    // true: only blocked tasks; false: only tasks that are not blocked; null: both. A task is blocked
    // while a task it depends on is not completed. Set by blockedIs(); TaskService applies it, since
    // whether a task is blocked is read from the dependencies, not from the task.
    private Boolean blocked;

    // An unknown status, priority, due filter or sort is a 400 (IllegalArgumentException), not an empty list.
    public TaskListQuery(String search, List<String> statuses, List<String> priorities, Long assigneeId,
                         Long projectId, String due, String sort) {
        this(search, statuses, priorities, assigneeId == null ? null : List.of(assigneeId), false, projectId, due,
                null, false, sort);
    }

    // assigneeIds: the task must be assigned to every one of them. unassigned: it has no assignee at all
    // (so together with an assignee it matches nothing). view: one of VIEWS, narrowing what the other
    // filters left. groupByProject: keep the tasks of a project together (done projects last), the sort
    // deciding the order inside each project.
    public TaskListQuery(String search, List<String> statuses, List<String> priorities, List<Long> assigneeIds,
                         boolean unassigned, Long projectId, String due, String view, boolean groupByProject,
                         String sort) {
        this.search = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        this.statuses = ListQueries.checked("status", statuses, STATUSES);
        this.priorities = ListQueries.checked("priority", priorities, PRIORITIES);
        this.assigneeIds = assigneeIds == null ? List.of() : assigneeIds;
        this.unassigned = unassigned;
        this.projectId = projectId;
        this.due = due == null || due.isBlank() ? null : due;
        if (this.due != null && !DUE_FILTERS.contains(this.due)) {
            throw new IllegalArgumentException("Invalid due: " + this.due);
        }
        this.view = view == null || view.isBlank() ? null : view;
        if (this.view != null && !VIEWS.contains(this.view)) {
            throw new IllegalArgumentException("Invalid view: " + this.view);
        }
        this.groupByProject = groupByProject;
        this.sort = ListQueries.checkedSort(sort, SORTS.keySet());
    }

    // Limits the list to tasks due between two dates, both included (null leaves that end open).
    public TaskListQuery dueBetween(LocalDate from, LocalDate to) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new IllegalArgumentException("Invalid range: dueTo is before dueFrom");
        }
        this.dueFrom = from;
        this.dueTo = to;
        return this;
    }

    // Limits the list to blocked tasks (true) or to tasks that are not blocked (false); null leaves both.
    public TaskListQuery blockedIs(Boolean blocked) {
        this.blocked = blocked;
        return this;
    }

    public Boolean blocked() {
        return blocked;
    }

    // Whether apply() needs to know who each task is assigned to.
    public boolean needsAssignees() {
        return !assigneeIds.isEmpty() || unassigned || !search.isEmpty();
    }

    // assigneesByTask: task id -> its assignees; only read when needsAssignees().
    public List<Task> apply(List<Task> tasks, Map<Long, List<User>> assigneesByTask) {
        LocalDate today = LocalDate.now();
        Stream<Task> matched = tasks.stream()
                .filter(t -> matches(t, assigneesByTask.getOrDefault(t.getId(), List.of()), today)
                        && inView(view, t, today));
        Comparator<Task> order = null;
        if (groupByProject) {
            order = BY_PROJECT;
        }
        if (sort != null) {
            order = order == null ? SORTS.get(sort) : order.thenComparing(SORTS.get(sort));
        }
        return order == null ? matched.toList() : matched.sorted(order).toList();
    }

    // How many tasks each quick view holds over what the other filters leave (the view itself is
    // ignored), keyed by the names in VIEWS.
    public Map<String, Long> viewCounts(List<Task> tasks, Map<Long, List<User>> assigneesByTask) {
        LocalDate today = LocalDate.now();
        List<Task> base = tasks.stream()
                .filter(t -> matches(t, assigneesByTask.getOrDefault(t.getId(), List.of()), today))
                .toList();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String name : VIEWS) {
            counts.put(name, base.stream().filter(t -> inView(name, t, today)).count());
        }
        return counts;
    }

    // How many of the tasks the filters leave (the view is ignored) each person has completed.
    public Map<Long, Long> completedByAssignee(List<Task> tasks, Map<Long, List<User>> assigneesByTask) {
        LocalDate today = LocalDate.now();
        Map<Long, Long> counts = new LinkedHashMap<>();
        for (Task t : tasks) {
            List<User> assignees = assigneesByTask.getOrDefault(t.getId(), List.of());
            if ("COMPLETED".equals(t.getStatus()) && matches(t, assignees, today)) {
                for (User u : assignees) {
                    counts.merge(u.getId(), 1L, Long::sum);
                }
            }
        }
        return counts;
    }

    // Today and Upcoming mean open tasks (not Completed or Cancelled) due today / after today;
    // Overdue is the shared calculation (B1.3).
    private static boolean inView(String view, Task t, LocalDate today) {
        if (view == null || "all".equals(view)) {
            return true;
        }
        boolean open = !"COMPLETED".equals(t.getStatus()) && !"CANCELLED".equals(t.getStatus());
        LocalDate dueDate = t.getDueDate();
        return switch (view) {
            case "today" -> open && today.equals(dueDate);
            case "upcoming" -> open && dueDate != null && dueDate.isAfter(today);
            case "inprogress" -> "IN_PROGRESS".equals(t.getStatus());
            case "completed" -> "COMPLETED".equals(t.getStatus());
            default -> Derived.isTaskOverdue(t.getStatus(), dueDate, today);
        };
    }

    private boolean matches(Task t, List<User> assignees, LocalDate today) {
        if (!statuses.isEmpty() && !statuses.contains(t.getStatus())) {
            return false;
        }
        if (!priorities.isEmpty() && !priorities.contains(t.getPriority())) {
            return false;
        }
        if (projectId != null && !projectId.equals(t.getProject().getId())) {
            return false;
        }
        if (unassigned && !assignees.isEmpty()) {
            return false;
        }
        for (Long assigneeId : assigneeIds) {
            if (assignees.stream().noneMatch(u -> assigneeId.equals(u.getId()))) {
                return false;
            }
        }
        if (!matchesDue(t, today)) {
            return false;
        }
        if ((dueFrom != null || dueTo != null)
                && (t.getDueDate() == null
                || (dueFrom != null && t.getDueDate().isBefore(dueFrom))
                || (dueTo != null && t.getDueDate().isAfter(dueTo)))) {
            return false;
        }
        return search.isEmpty() || haystack(t, assignees).contains(search);
    }

    // The same four choices as the task screen: overdue (B1.3), due today, due within the
    // next 7 days, or no due date.
    private boolean matchesDue(Task t, LocalDate today) {
        if (due == null) {
            return true;
        }
        LocalDate dueDate = t.getDueDate();
        return switch (due) {
            case "none" -> dueDate == null;
            case "today" -> today.equals(dueDate);
            case "week" -> dueDate != null && !dueDate.isBefore(today) && !dueDate.isAfter(today.plusDays(7));
            default -> Derived.isTaskOverdue(t.getStatus(), dueDate, today);
        };
    }

    // Name, assignee, project, priority, status and due date (brief B1.9), plus the description
    // the task screen also searches.
    private static String haystack(Task t, List<User> assignees) {
        String assigneeNames = assignees.stream().map(User::getFullName).collect(Collectors.joining(" "));
        return ListQueries.text(t.getTitle(), t.getDescription(), t.getProject().getName(), assigneeNames,
                ListQueries.humanize(t.getPriority()), ListQueries.humanize(t.getStatus()), t.getDueDate());
    }
}
