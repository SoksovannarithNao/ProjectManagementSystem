package backend.util;

import backend.entity.Project;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

// Search, filter and sort of the project list (assignment-brief.md B1.9, B7.2). It only ever
// narrows or reorders the projects it is given - the service passes in the ones the caller may
// already see - so a query can never reveal a project the caller cannot open. Filters combine
// with AND; several values of one filter (status, priority) combine with OR. A query with no
// parameter returns the list unchanged.
public final class ProjectListQuery {

    // DELAYED is not stored: it is calculated from the end date (Derived.isProjectDelayed).
    private static final Set<String> STATUSES =
            Set.of("PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "DELAYED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final Map<String, Integer> PRIORITY_RANK = Map.of("CRITICAL", 0, "HIGH", 1, "MEDIUM", 2, "LOW", 3);
    private static final Map<String, Comparator<Project>> SORTS = Map.of(
            "name", Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER),
            "startDate", Comparator.comparing(Project::getStartDate, Comparator.nullsLast(Comparator.naturalOrder())),
            "endDate", Comparator.comparing(Project::getEndDate, Comparator.nullsLast(Comparator.naturalOrder())),
            "priority", Comparator.comparing(p -> PRIORITY_RANK.getOrDefault(p.getPriority(), 9)),
            "progress", Comparator.comparing((Project p) -> p.getProgress() == null ? BigDecimal.ZERO : p.getProgress()).reversed());

    private final String search;
    private final List<String> statuses;
    private final List<String> priorities;
    private final Long managerId;
    private final String sort;

    // An unknown status, priority or sort is a 400 (IllegalArgumentException), not an empty list.
    public ProjectListQuery(String search, List<String> statuses, List<String> priorities, Long managerId, String sort) {
        this.search = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        this.statuses = ListQueries.checked("status", statuses, STATUSES);
        this.priorities = ListQueries.checked("priority", priorities, PRIORITIES);
        this.managerId = managerId;
        this.sort = ListQueries.checkedSort(sort, SORTS.keySet());
    }

    public List<Project> apply(List<Project> projects) {
        LocalDate today = LocalDate.now();
        Stream<Project> matched = projects.stream().filter(p -> matches(p, today));
        return sort == null ? matched.toList() : matched.sorted(SORTS.get(sort)).toList();
    }

    private boolean matches(Project p, LocalDate today) {
        boolean delayed = Derived.isProjectDelayed(p.getStatus(), p.getEndDate(), today);
        if (!statuses.isEmpty() && !statuses.contains(p.getStatus()) && !(delayed && statuses.contains("DELAYED"))) {
            return false;
        }
        if (!priorities.isEmpty() && !priorities.contains(p.getPriority())) {
            return false;
        }
        if (managerId != null && !managerId.equals(p.getManager().getId())) {
            return false;
        }
        return search.isEmpty() || haystack(p, delayed).contains(search);
    }

    // Name, manager, status and dates (brief B1.9), plus the description and code the project
    // page also searches. "Active" is the specification's word for a project that is in progress.
    private static String haystack(Project p, boolean delayed) {
        return ListQueries.text(p.getName(), p.getDescription(), p.getProjectCode(), p.getManager().getFullName(),
                ListQueries.humanize(p.getStatus()), "IN_PROGRESS".equals(p.getStatus()) ? "active" : null,
                delayed ? "delayed" : null, p.getStartDate(), p.getEndDate());
    }
}
