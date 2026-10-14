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
        assertThatThrownBy(() -> run(null, null, null, null, null, null, "colour")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> view("soon")).isInstanceOf(IllegalArgumentException.class);
    }

    // ---- the task screen: quick views, unassigned, several assignees, project groups (risk R-5) ----

    private TaskListQuery full(List<Long> assigneeIds, boolean unassigned, Long projectId, String view, boolean groupByProject, String sort) {
        return new TaskListQuery(null, null, null, assigneeIds, unassigned, projectId, null, view, groupByProject, sort);
    }

    private List<Task> view(String name) {
        return full(null, false, null, name, false, null).apply(all, assignees);
    }

    @Test
    void sortByTitle_isAlphabeticalIgnoringCase() {
        assertThat(run(null, null, null, null, null, null, "title")).containsExactly(build, design, undated, test, late);
    }

    @Test
    void quickViews_narrowWhatTheOtherFiltersLeave() {
        assertThat(view("all")).containsExactly(design, build, test, late, undated);
        assertThat(view("upcoming")).containsExactly(design, build);
        assertThat(view("inprogress")).containsExactly(design, late);
        assertThat(view("completed")).containsExactly(test);
        assertThat(view("overdue")).containsExactly(late);
        assertThat(view("today")).isEmpty();
    }

    @Test
    void theTodayView_holdsOpenTasksDueToday_notFinishedOnes() {
        Task open = task(6L, "Due today", alpha, "TODO", "LOW", today, "0", "2026-10-05T09:00:00Z");
        Task finished = task(7L, "Done today", alpha, "COMPLETED", "LOW", today, "100", "2026-10-05T10:00:00Z");

        assertThat(full(null, false, null, "today", false, null).apply(List.of(open, finished), Map.of())).containsExactly(open);
    }

    @Test
    void viewCounts_ignoreTheViewButKeepTheOtherFilters() {
        Map<String, Long> everything = full(null, false, null, "completed", false, null).viewCounts(all, assignees);
        assertThat(everything).containsEntry("all", 5L).containsEntry("upcoming", 2L).containsEntry("inprogress", 2L)
                .containsEntry("completed", 1L).containsEntry("overdue", 1L).containsEntry("today", 0L);
        assertThat(everything.keySet()).containsExactlyElementsOf(TaskListQuery.VIEWS);

        Map<String, Long> inBeta = full(null, false, 20L, null, false, null).viewCounts(all, assignees);
        assertThat(inBeta).containsEntry("all", 3L).containsEntry("upcoming", 0L).containsEntry("inprogress", 1L)
                .containsEntry("completed", 1L).containsEntry("overdue", 1L);
    }

    @Test
    void unassigned_keepsOnlyTasksWithNoAssignee_andNothingWhenAnAssigneeIsAlsoNamed() {
        assertThat(full(null, true, null, null, false, null).apply(all, assignees)).containsExactly(undated);
        assertThat(full(List.of(1L), true, null, null, false, null).apply(all, assignees)).isEmpty();
        assertThat(full(null, true, null, null, false, null).needsAssignees()).isTrue();
    }

    @Test
    void severalAssignees_mustAllHoldTheTask() {
        assertThat(full(List.of(1L, 2L), false, null, null, false, null).apply(all, assignees)).containsExactly(build);
        assertThat(full(List.of(2L, 2L), false, null, null, false, null).apply(all, assignees)).containsExactly(build, test, late);
    }

    // ---- the calendar window and the project counts (risk R-5) ----

    @Test
    void dueBetween_keepsTasksDueInTheWindowBothEndsIncluded_andDropsUndatedOnes() {
        Task early = task(6L, "Early", alpha, "TODO", "LOW", today.minusDays(10), "0", "2026-10-05T09:00:00Z");
        Task onStart = task(7L, "On the first day", alpha, "TODO", "LOW", today.minusDays(5), "0", "2026-10-05T09:01:00Z");
        Task onEnd = task(8L, "On the last day", alpha, "TODO", "LOW", today.plusDays(2), "0", "2026-10-05T09:02:00Z");
        Task late = task(9L, "Late", alpha, "TODO", "LOW", today.plusDays(3), "0", "2026-10-05T09:03:00Z");
        Task undated = task(10L, "Undated", alpha, "TODO", "LOW", null, "0", "2026-10-05T09:04:00Z");
        List<Task> tasks = List.of(early, onStart, onEnd, late, undated);

        List<Task> window = full(null, false, null, null, false, null).dueBetween(today.minusDays(5), today.plusDays(2)).apply(tasks, Map.of());

        assertThat(window).containsExactly(onStart, onEnd);
    }

    @Test
    void dueBetween_withOneEndOpen_andWithNoEnds() {
        assertThat(full(null, false, null, null, false, null).dueBetween(today, null).apply(all, assignees)).containsExactly(design, build);
        assertThat(full(null, false, null, null, false, null).dueBetween(null, today.minusDays(4)).apply(all, assignees)).containsExactly(test);
        assertThat(full(null, false, null, null, false, null).dueBetween(null, null).apply(all, assignees)).containsExactly(design, build, test, late, undated);
    }

    @Test
    void dueBetween_combinesWithTheOtherFilters_andARangeBackwardsIsRefused() {
        assertThat(full(null, false, 20L, null, false, null).dueBetween(today.minusDays(6), today).apply(all, assignees)).containsExactly(test, late);
        assertThatThrownBy(() -> full(null, false, null, null, false, null).dueBetween(today, today.minusDays(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void completedByAssignee_countsCompletedTasksPerPerson_oncePerTask() {
        Task both = task(6L, "Shared", alpha, "COMPLETED", "LOW", today, "100", "2026-10-05T09:00:00Z");
        Task mine = task(7L, "Mine", alpha, "COMPLETED", "LOW", today, "100", "2026-10-05T10:00:00Z");
        List<Task> tasks = List.of(design, test, both, mine);
        Map<Long, List<User>> who = Map.of(1L, List.of(olivia), 3L, List.of(david), 6L, List.of(olivia, david), 7L, List.of(olivia));

        Map<Long, Long> counts = full(null, false, null, null, false, null).completedByAssignee(tasks, who);

        // design is not finished; test is david's; shared is both people's; mine is olivia's
        assertThat(counts).containsEntry(1L, 2L).containsEntry(2L, 2L).hasSize(2);
    }

    @Test
    void completedByAssignee_followsTheOtherFilters_ignoresTheView_andOmitsPeopleWithNone() {
        // Beta holds only `test` (completed, david's); Alpha has nothing completed
        assertThat(full(null, false, 20L, null, false, null).completedByAssignee(all, assignees)).containsOnlyKeys(2L).containsEntry(2L, 1L);
        assertThat(full(null, false, 10L, null, false, null).completedByAssignee(all, assignees)).isEmpty();
        assertThat(full(null, false, 20L, "overdue", false, null).completedByAssignee(all, assignees)).containsEntry(2L, 1L);
        assertThat(full(List.of(1L), false, null, null, false, null).completedByAssignee(all, assignees)).isEmpty();
    }

    @Test
    void blockedIs_isRememberedForTheServiceToApply_andLeavesTheListAloneItself() {
        TaskListQuery query = full(null, false, null, null, false, null).blockedIs(true);

        assertThat(query.blocked()).isTrue();
        assertThat(full(null, false, null, null, false, null).blocked()).isNull();
        assertThat(query.apply(all, assignees)).containsExactly(design, build, test, late, undated);
    }

    @Test
    void groupByProject_keepsProjectsTogetherWithFinishedOnesLast_andSortsInsideEach() {
        Project done = project(30L, "Aardvark");
        done.setProgress(new BigDecimal("100"));
        Task doneTask = task(6L, "Wrap up", done, "COMPLETED", "LOW", today.minusDays(9), "100", "2026-10-05T09:00:00Z");
        List<Task> mixed = List.of(doneTask, test, build, late, design, undated);

        List<Task> grouped = full(null, false, null, null, true, "dueDate").apply(mixed, assignees);

        // Alpha (design, build), Beta (test, late, undated), then the finished Aardvark last
        assertThat(grouped).containsExactly(design, build, test, late, undated, doneTask);
        // without the grouping the same sort mixes the projects
        assertThat(full(null, false, null, null, false, "dueDate").apply(mixed, assignees)).startsWith(doneTask);
    }
}
