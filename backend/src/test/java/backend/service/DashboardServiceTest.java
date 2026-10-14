package backend.service;

import backend.dto.DashboardStatsResponse;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The dashboard figures (assignment-brief.md B1.3, D-06): what counts as active,
// delayed and overdue, over only what the caller may see.
@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private DashboardService service;
    private User caller;

    @BeforeEach
    void setUp() {
        service = new DashboardService(projectRepository, projectMemberRepository, taskRepository, userRepository,
                projectAccessGuard);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("pm.olivia");
        when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
    }

    private Project project(long id, String name, String status, LocalDate end, int progress) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setProjectCode("PRJ-" + id);
        p.setName(name);
        p.setStatus(status);
        p.setEndDate(end);
        p.setProgress(BigDecimal.valueOf(progress));
        return p;
    }

    private Task task(String status, LocalDate due) {
        Task t = new Task();
        t.setStatus(status);
        t.setDueDate(due);
        return t;
    }

    private void visible(List<Project> projects, List<Task> tasks) {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(1L, 2L, 3L, 4L, 5L, 6L));
        when(projectRepository.findByIdIn(List.of(1L, 2L, 3L, 4L, 5L, 6L))).thenReturn(projects);
        when(taskRepository.findByProjectIdIn(List.of(1L, 2L, 3L, 4L, 5L, 6L))).thenReturn(tasks);
    }

    @Test
    void countsProjectsByStatus_andDelayedIsADerivedGroupThatOverlaps() {
        visible(List.of(
                project(1, "Planned", "PLANNING", TODAY.plusDays(30), 0),
                project(2, "Running", "IN_PROGRESS", TODAY.plusDays(30), 40),
                project(3, "Late", "IN_PROGRESS", TODAY.minusDays(5), 60),
                project(4, "Paused and late", "ON_HOLD", TODAY.minusDays(1), 20),
                project(5, "Done", "COMPLETED", TODAY.minusDays(40), 100),
                project(6, "Dropped", "CANCELLED", TODAY.minusDays(40), 10)), List.of());

        DashboardStatsResponse.ProjectStats stats = service.getStats("pm.olivia", TODAY).getProjects();

        assertThat(stats.total()).isEqualTo(6);
        assertThat(stats.planning()).isEqualTo(1);
        assertThat(stats.active()).as("active is IN_PROGRESS only, a planned project is not active").isEqualTo(2);
        assertThat(stats.onHold()).isEqualTo(1);
        assertThat(stats.completed()).isEqualTo(1);
        assertThat(stats.cancelled()).isEqualTo(1);
        assertThat(stats.delayed()).as("end date passed and not completed / cancelled").isEqualTo(2);
    }

    @Test
    void averageProgress_leavesOutCancelledProjects() {
        visible(List.of(
                project(1, "A", "IN_PROGRESS", TODAY.plusDays(5), 40),
                project(2, "B", "COMPLETED", TODAY.minusDays(5), 100),
                project(3, "C", "CANCELLED", TODAY.minusDays(5), 0)), List.of());

        assertThat(service.getStats("pm.olivia", TODAY).getProjects().averageProgress()).isEqualByComparingTo("70.0");
    }

    @Test
    void noProjects_meansZeroEverywhere_notAnError() {
        visible(List.of(), List.of());

        DashboardStatsResponse stats = service.getStats("pm.olivia", TODAY);

        assertThat(stats.getProjects().total()).isZero();
        assertThat(stats.getProjects().averageProgress()).isEqualByComparingTo("0");
        assertThat(stats.getTasks().total()).isZero();
        assertThat(stats.getDelayedProjects()).isEmpty();
    }

    @Test
    void countsTasksByStatus_andOverdueOverlapsTheOpenOnes() {
        visible(List.of(), List.of(
                task("TODO", TODAY.plusDays(2)),
                task("TODO", TODAY.minusDays(3)),
                task("IN_PROGRESS", TODAY.minusDays(1)),
                task("IN_PROGRESS", TODAY),
                task("IN_REVIEW", TODAY.minusDays(9)),
                task("COMPLETED", TODAY.minusDays(9)),
                task("CANCELLED", TODAY.minusDays(9))));

        DashboardStatsResponse.TaskStats stats = service.getStats("pm.olivia", TODAY).getTasks();

        assertThat(stats.total()).isEqualTo(7);
        assertThat(stats.todo()).isEqualTo(2);
        assertThat(stats.inProgress()).isEqualTo(2);
        assertThat(stats.inReview()).as("In Review is its own count").isEqualTo(1);
        assertThat(stats.completed()).isEqualTo(1);
        assertThat(stats.cancelled()).as("cancelled is shown separately").isEqualTo(1);
        assertThat(stats.overdue()).as("past due and not completed / cancelled; due today is not overdue").isEqualTo(3);
    }

    @Test
    void theDelayedList_isMostLateFirst_andAtMostFive() {
        visible(List.of(
                project(1, "A", "IN_PROGRESS", TODAY.minusDays(2), 10),
                project(2, "B", "IN_PROGRESS", TODAY.minusDays(30), 10),
                project(3, "C", "ON_HOLD", TODAY.minusDays(10), 10),
                project(4, "D", "PLANNING", TODAY.minusDays(4), 10),
                project(5, "E", "IN_PROGRESS", TODAY.minusDays(8), 10),
                project(6, "F", "IN_PROGRESS", TODAY.minusDays(1), 10)), List.of());

        List<DashboardStatsResponse.DelayedProject> delayed = service.getStats("pm.olivia", TODAY).getDelayedProjects();

        assertThat(delayed).extracting(DashboardStatsResponse.DelayedProject::name)
                .containsExactly("B", "C", "E", "D", "A");
        assertThat(delayed.get(0).daysDelayed()).isEqualTo(30);
    }

    @Test
    void anAdministratorSeesEveryProject_everyoneElseOnlyTheirOwn() {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(true);
        when(projectRepository.findAll()).thenReturn(List.of(project(1, "A", "IN_PROGRESS", TODAY, 0)));
        when(taskRepository.findAll()).thenReturn(List.of());

        assertThat(service.getStats("pm.olivia", TODAY).getProjects().total()).isEqualTo(1);
        verify(projectMemberRepository, never()).findProjectIdsByUserId(1L);
    }
}
