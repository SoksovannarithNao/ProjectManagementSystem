package backend.util;

import backend.entity.Project;
import backend.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Search / filter / sort of the project list (brief B1.9, B7.2, G-16).
class ProjectListQueryTest {

    private final User olivia = user(1L, "Olivia Reed");
    private final User david = user(2L, "David Chen");

    private final Project apollo = project(1L, "Apollo", "IN_PROGRESS", "HIGH", olivia, "2026-01-10", "2099-06-30", "40");
    private final Project borealis = project(2L, "Borealis", "COMPLETED", "LOW", david, "2026-03-01", "2026-04-01", "100");
    private final Project cirrus = project(3L, "Cirrus", "ON_HOLD", "CRITICAL", olivia, "2026-02-01", "2099-09-30", "10");
    // Ended in the past and still running: delayed.
    private final Project dune = project(4L, "Dune", "IN_PROGRESS", "MEDIUM", david, "2025-01-01", "2025-06-30", "70");

    private final List<Project> all = List.of(apollo, borealis, cirrus, dune);

    private static User user(Long id, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName(fullName);
        return u;
    }

    private static Project project(Long id, String name, String status, String priority, User manager,
                                   String start, String end, String progress) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setName(name);
        p.setStatus(status);
        p.setPriority(priority);
        p.setManager(manager);
        p.setStartDate(LocalDate.parse(start));
        p.setEndDate(LocalDate.parse(end));
        p.setProgress(new BigDecimal(progress));
        return p;
    }

    private List<Project> run(String search, List<String> status, List<String> priority, Long managerId, String sort) {
        return new ProjectListQuery(search, status, priority, managerId, sort).apply(all);
    }

    @Test
    void noParameters_returnsTheListUnchanged() {
        assertThat(run(null, null, null, null, null)).containsExactly(apollo, borealis, cirrus, dune);
    }

    @Test
    void search_matchesNameManagerAndStatusIgnoringCase() {
        assertThat(run("apol", null, null, null, null)).containsExactly(apollo);
        assertThat(run("DAVID", null, null, null, null)).containsExactly(borealis, dune);
        assertThat(run("on hold", null, null, null, null)).containsExactly(cirrus);
        // "Active" is the specification's word for a project in progress.
        assertThat(run("active", null, null, null, null)).containsExactly(apollo, dune);
    }

    @Test
    void search_matchesADate() {
        assertThat(run("2026-03", null, null, null, null)).containsExactly(borealis);
    }

    @Test
    void filters_byStatus_priority_andManager_andCombineWithAnd() {
        assertThat(run(null, List.of("COMPLETED"), null, null, null)).containsExactly(borealis);
        assertThat(run(null, List.of("COMPLETED", "ON_HOLD"), null, null, null)).containsExactly(borealis, cirrus);
        assertThat(run(null, null, List.of("CRITICAL", "HIGH"), null, null)).containsExactly(apollo, cirrus);
        assertThat(run(null, null, null, 1L, null)).containsExactly(apollo, cirrus);
        assertThat(run(null, List.of("IN_PROGRESS"), List.of("MEDIUM"), 2L, null)).containsExactly(dune);
        assertThat(run("apollo", List.of("COMPLETED"), null, null, null)).isEmpty();
    }

    @Test
    void delayedIsACalculatedStatusFilter() {
        assertThat(run(null, List.of("DELAYED"), null, null, null)).containsExactly(dune);
    }

    @Test
    void sorts_byEachFieldOfTheBrief() {
        assertThat(run(null, null, null, null, "name")).containsExactly(apollo, borealis, cirrus, dune);
        assertThat(run(null, null, null, null, "startDate")).containsExactly(dune, apollo, cirrus, borealis);
        assertThat(run(null, null, null, null, "endDate")).containsExactly(dune, borealis, apollo, cirrus);
        assertThat(run(null, null, null, null, "priority")).containsExactly(cirrus, apollo, dune, borealis);
        assertThat(run(null, null, null, null, "progress")).containsExactly(borealis, dune, apollo, cirrus);
    }

    @Test
    void anUnknownStatusPriorityOrSort_isRejected() {
        assertThatThrownBy(() -> run(null, List.of("BOGUS"), null, null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> run(null, null, List.of("URGENT"), null, null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> run(null, null, null, null, "bogus")).isInstanceOf(IllegalArgumentException.class);
    }
}
