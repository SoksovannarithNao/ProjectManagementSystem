package backend.util;

import backend.entity.Task;
import backend.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
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
    private static final Map<String, Integer> PRIORITY_RANK = Map.of("URGENT", 0, "HIGH", 1, "MEDIUM", 2, "LOW", 3);
    private static final Map<String, Integer> STATUS_RANK =
            Map.of("TODO", 0, "IN_PROGRESS", 1, "IN_REVIEW", 2, "COMPLETED", 3, "CANCELLED", 4);
    private static final Map<String, Comparator<Task>> SORTS = Map.of(
            "latest", Comparator.comparing(Task::getCreatedAt, Comparator.nullsLast(Comparator.<OffsetDateTime>naturalOrder().reversed())),
            "dueDate", Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())),
            "priority", Comparator.comparing(t -> PRIORITY_RANK.getOrDefault(t.getPriority(), 9)),
            "progress", Comparator.comparing((Task t) -> t.getProgress() == null ? BigDecimal.ZERO : t.getProgress()).reversed(),
            "status", Comparator.comparing(t -> STATUS_RANK.getOrDefault(t.getStatus(), 9)));

    private final String search;
    private final List<String> statuses;
    private final List<String> priorities;
    private final Long assigneeId;
    private final Long projectId;
    private final String due;
    private final String sort;

    // An unknown status, priority, due filter or sort is a 400 (IllegalArgumentException), not an empty list.
    public TaskListQuery(String search, List<String> statuses, List<String> priorities, Long assigneeId,
                         Long projectId, String due, String sort) {
        this.search = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        this.statuses = ListQueries.checked("status", statuses, STATUSES);
        this.priorities = ListQueries.checked("priority", priorities, PRIORITIES);
        this.assigneeId = assigneeId;
        this.projectId = projectId;
        this.due = due == null || due.isBlank() ? null : due;
        if (this.due != null && !DUE_FILTERS.contains(this.due)) {
            throw new IllegalArgumentException("Invalid due: " + this.due);
        }
        this.sort = ListQueries.checkedSort(sort, SORTS.keySet());
    }

    // Whether apply() needs to know who each task is assigned to.
    public boolean needsAssignees() {
        return assigneeId != null || !search.isEmpty();
    }

    // assigneesByTask: task id -> its assignees; only read when needsAssignees().
    public List<Task> apply(List<Task> tasks, Map<Long, List<User>> assigneesByTask) {
        LocalDate today = LocalDate.now();
        Stream<Task> matched = tasks.stream()
                .filter(t -> matches(t, assigneesByTask.getOrDefault(t.getId(), List.of()), today));
        return sort == null ? matched.toList() : matched.sorted(SORTS.get(sort)).toList();
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
        if (assigneeId != null && assignees.stream().noneMatch(u -> assigneeId.equals(u.getId()))) {
            return false;
        }
        if (!matchesDue(t, today)) {
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
