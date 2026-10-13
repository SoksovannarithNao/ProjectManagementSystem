package backend.util;

import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Search / filter / sort of the task list (brief B1.9, B7.2, G-16).
class TaskListQueryTest {

    private final LocalDate today = LocalDate.now();

    private final User olivia = user(1L, "Olivia Reed");
    private final User david = user(2L, "David Chen");
    private final Project alpha = project(10L, "Alpha");
    private final Project beta = project(20L, "Beta");

    private final Task design = task(1L, "Design the logo", alpha, "IN_PROGRESS", "HIGH", today.plusDays(2), "50", "2026-10-01T09:00:00Z");
    private final Task build = task(2L, "Build the site", alpha, "TODO", "URGENT", today.plusDays(20), "0", "2026-10-03T09:00:00Z");
    private final Task test = task(3L, "Test the site", beta, "COMPLETED", "LOW", today.minusDays(5), "100", "2026-10-02T09:00:00Z");
    private final Task late = task(4L, "Write the docs", beta, "IN_PROGRESS", "MEDIUM", today.minusDays(3), "30", "2026-09-30T09:00:00Z");
    private final Task undated = task(5L, "Plan the launch", beta, "TODO", "MEDIUM", null, "0", "2026-10-04T09:00:00Z");

    private final List<Task> all = List.of(design, build, test, late, undated);
    private final Map<Long, List<User>> assignees = Map.of(
            1L, List.of(olivia), 2L, List.of(olivia, david), 3L, List.of(david), 4L, List.of(david));

    private static User user(Long id, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName(fullName);
        return u;
    }

    private static Project project(Long id, String name) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setName(name);
        return p;
    }

    private static Task task(Long id, String title, Project project, String status, String priority,
                             LocalDate due, String progress, String createdAt) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        ReflectionTestUtils.setField(t, "createdAt", OffsetDateTime.parse(createdAt));
        t.setTitle(title);
        t.setProject(project);
        t.setStatus(status);
        t.setPriority(priority);
        t.setDueDate(due);
        t.setProgress(new BigDecimal(progress));
        return t;
    }

    private List<Task> run(String search, List<String> status, List<String> priority, Long assigneeId,
                           Long projectId, String due, String sort) {
        return new TaskListQuery(search, status, priority, assigneeId, projectId, due, sort).apply(all, assignees);
    }

    @Test
    void noParameters_returnsTheListUnchanged() {
        assertThat(run(null, null, null, null, null, null, null)).containsExactly(design, build, test, late, undated);
    }

    @Test
    void search_matchesTitleProjectAssigneePriorityStatusAndDueDate() {
        assertThat(run("SITE", null, null, null, null, null, null)).containsExactly(build, test);
        assertThat(run("beta", null, null, null, null, null, null)).containsExactly(test, late, undated);
        assertThat(run("olivia", null, null, null, null, null, null)).containsExactly(design, build);
        assertThat(run("urgent", null, null, null, null, null, null)).containsExactly(build);
        assertThat(run("in progress", null, null, null, null, null, null)).containsExactly(design, late);
        assertThat(run(design.getDueDate().toString(), null, null, null, null, null, null)).containsExactly(design);
    }

    @Test
    void filters_byStatus_priority_assignee_project_andCombineWithAnd() {
        assertThat(run(null, List.of("TODO"), null, null, null, null, null)).containsExactly(build, undated);
        assertThat(run(null, null, List.of("HIGH", "LOW"), null, null, null, null)).containsExactly(design, test);
        assertThat(run(null, null, null, 2L, null, null, null)).containsExactly(build, test, late);
        assertThat(run(null, null, null, null, 20L, null, null)).containsExactly(test, late, undated);
        assertThat(run(null, List.of("IN_PROGRESS"), null, 2L, 20L, null, null)).containsExactly(late);
        assertThat(run("site", List.of("COMPLETED"), null, 1L, null, null, null)).isEmpty();
    }

    @Test
    void dueFilter_overdueTodayWeekAndNone() {
        // Overdue means open: the completed task past its date is not overdue.
        assertThat(run(null, null, null, null, null, "overdue", null)).containsExactly(late);
        assertThat(run(null, null, null, null, null, "week", null)).containsExactly(design);
        assertThat(run(null, null, null, null, null, "none", null)).containsExactly(undated);
        assertThat(run(null, null, null, null, null, "today", null)).isEmpty();
    }

    @Test
    void sorts_byEachFieldOfTheBrief() {
        assertThat(run(null, null, null, null, null, null, "latest")).containsExactly(undated, build, test, design, late);
        assertThat(run(null, null, null, null, null, null, "dueDate")).containsExactly(test, late, design, build, undated);
        assertThat(run(null, null, null, null, null, null, "priority")).containsExactly(build, design, late, undated, test);
        assertThat(run(null, null, null, null, null, null, "progress")).containsExactly(test, design, late, build, undated);
        assertThat(run(null, null, null, null, null, null, "status")).containsExactly(build, undated, design, late, test);
    }

    @Test
    void needsAssigneesOnlyForASearchOrAnAssigneeFilter() {
        assertThat(new TaskListQuery(null, null, null, null, 10L, "overdue", "latest").needsAssignees()).isFalse();
        assertThat(new TaskListQuery("x", null, null, null, null, null, null).needsAssignees()).isTrue();
        assertThat(new TaskListQuery(null, null, null, 1L, null, null, null).needsAssignees()).isTrue();
    }

    @Test
    void anUnknownStatusPriorityDueOrSort_isRejected() {
        assertThatThrownBy(() -> run(null, List.of("DONE"), null, null, null, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> run(null, null, List.of("CRITICAL"), null, null, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> run(null, null, null, null, null, "soon", null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> run(null, null, null, null, null, null, "title")).isInstanceOf(IllegalArgumentException.class);
    }
}
