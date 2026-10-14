package backend.service;

import backend.dto.ReportsResponse.*;
import backend.dto.TeamViewsResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The five KPIs and the seven named reports (assignment-brief.md B8, D-12): who may
// generate them, what each contains, and that the formulas are the approved ones.
@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private MilestoneRepository milestoneRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private TeamViewsService teamViewsService;

    private ReportService service;
    private User leader;
    private User ana;
    private User ben;
    private Project alpha;
    private Project beta;
    private final List<Task> tasks = new ArrayList<>();
    private final List<TaskAssignee> assignments = new ArrayList<>();
    private long nextId = 100;

    @BeforeEach
    void setUp() {
        service = new ReportService(projectRepository, projectMemberRepository, taskRepository, taskAssigneeRepository,
                milestoneRepository, userRepository, projectAccessGuard, teamViewsService);
        leader = user(1L, "lead.owen", "Owen Leader");
        ana = user(2L, "dev.ana", "Ana");
        ben = user(3L, "dev.ben", "Ben");
        alpha = project(10L, "Alpha", "IN_PROGRESS", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 31));
        beta = project(20L, "Beta", "IN_PROGRESS", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 31));
        // the leader leads both projects
        lenient().when(projectAccessGuard.isAdmin(leader)).thenReturn(false);
        lenient().when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L, 20L));
        lenient().when(projectAccessGuard.can(leader, 10L, Resource.REPORT, Action.GENERATE_REPORTS)).thenReturn(true);
        lenient().when(projectAccessGuard.can(leader, 20L, Resource.REPORT, Action.GENERATE_REPORTS)).thenReturn(true);
        lenient().when(projectRepository.findByIdIn(List.of(10L, 20L))).thenAnswer(inv -> List.of(alpha, beta));
        lenient().when(taskRepository.findByProjectIdIn(List.of(10L, 20L))).thenAnswer(inv -> tasks);
        lenient().when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L, 20L))).thenAnswer(inv -> assignments);
    }

    private User user(Long id, String username, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(fullName);
        u.setAccountStatus("ACTIVE");
        lenient().when(userRepository.findByUsername(username)).thenReturn(Optional.of(u));
        return u;
    }

    private Project project(Long id, String name, String status, LocalDate start, LocalDate end) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setProjectCode("PRJ-" + id);
        p.setName(name);
        p.setStatus(status);
        p.setStartDate(start);
        p.setEndDate(end);
        p.setProgress(BigDecimal.TEN);
        p.setManager(leader);
        lenient().when(projectRepository.findById(id)).thenAnswer(inv -> Optional.of(p));
        return p;
    }

    private Task task(Project project, String status, LocalDate start, LocalDate due, OffsetDateTime completedAt, User... who) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", nextId++);
        t.setProject(project);
        t.setTitle("Task " + t.getId());
        t.setStatus(status);
        t.setPriority("MEDIUM");
        t.setStartDate(start);
        t.setDueDate(due);
        t.setProgress(BigDecimal.ZERO);
        t.setCompletedAt(completedAt);
        tasks.add(t);
        for (User u : who) {
            TaskAssignee ta = new TaskAssignee();
            ReflectionTestUtils.setField(ta, "id", nextId++);
            ta.setTask(t);
            ta.setUser(u);
            assignments.add(ta);
        }
        return t;
    }

    private static OffsetDateTime at(int month, int day) {
        return OffsetDateTime.of(2026, month, day, 12, 0, 0, 0, ZoneOffset.UTC);
    }

    private static LocalDate d(int month, int day) {
        return LocalDate.of(2026, month, day);
    }

    // ---- who may generate -----------------------------------------------------------

    @Test
    void aMemberWhoCannotGenerateReports_isRefusedEverywhere() {
        User chen = user(9L, "dev.chen", "Chen");
        when(projectAccessGuard.isAdmin(chen)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(9L)).thenReturn(List.of(10L));
        when(projectAccessGuard.can(chen, 10L, Resource.REPORT, Action.GENERATE_REPORTS)).thenReturn(false);

        assertThatThrownBy(() -> service.getKpis("dev.chen", null, TODAY))
                .isInstanceOf(AccessDeniedException.class).hasMessageContaining("generate reports");
        assertThatThrownBy(() -> service.getTaskReport("dev.chen", null, null, null, null, null, null, TODAY))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.getWorkloadReport("dev.chen", 10L, TODAY))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aProjectOutsideTheCallersReportableSet_isRefused_evenWhenTheIdIsGuessed() {
        Project secret = project(99L, "Secret", "IN_PROGRESS", d(1, 1), d(12, 31));

        // a stranger to the project: it looks as if it does not exist
        org.mockito.Mockito.doThrow(new NotFoundException("Project not found")).when(projectAccessGuard).assertAccess(leader, 99L);
        assertThatThrownBy(() -> service.getTaskReport("lead.owen", 99L, null, null, null, null, null, TODAY))
                .isInstanceOf(NotFoundException.class);
        // a member of it without the right to report on it
        org.mockito.Mockito.doNothing().when(projectAccessGuard).assertAccess(leader, 99L);
        assertThat(secret.getId()).isEqualTo(99L);
        assertThatThrownBy(() -> service.getTaskReport("lead.owen", 99L, null, null, null, null, null, TODAY))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("for this project");
    }

    @Test
    void anUnknownProject_isNotFound() {
        when(projectRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getTaskReport("lead.owen", 404L, null, null, null, null, null, TODAY))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void anAdministratorReportsOnEveryProject() {
        User admin = user(7L, "admin.system", "Ada");
        when(projectAccessGuard.isAdmin(admin)).thenReturn(true);
        when(projectRepository.findAll()).thenReturn(List.of(alpha, beta));
        when(taskRepository.findByProjectIdIn(List.of(10L, 20L))).thenReturn(List.of());

        assertThat(service.getKpis("admin.system", null, TODAY).scope().projects()).isEqualTo(2);
    }

    // ---- KPIs (D-12) -----------------------------------------------------------------

    @Test
    void theFiveKpisUseTheApprovedFormulas() {
        // a completed on time (due 2 Oct, done 1 Oct, started 21 Sep: 10 days)
        task(alpha, "COMPLETED", d(9, 21), d(10, 2), at(10, 1), ana);
        // a completed late (due 2 Oct, done 5 Oct, started 25 Sep: 10 days)
        task(alpha, "COMPLETED", d(9, 25), d(10, 2), at(10, 5), ben);
        // open and overdue, open and not yet due, cancelled (left out of every rate)
        task(alpha, "IN_PROGRESS", d(10, 1), d(10, 5), null, ana);
        task(beta, "TODO", d(10, 1), d(11, 30), null, ben);
        task(beta, "CANCELLED", d(10, 1), d(10, 5), null);
        alpha.setStatus("COMPLETED");
        beta.setStatus("IN_PROGRESS");

        Kpis kpis = service.getKpis("lead.owen", null, TODAY);

        assertThat(kpis.projectCompletionRate()).as("1 completed / 2 projects").isEqualByComparingTo("50.0");
        assertThat(kpis.taskCompletionRate()).as("2 completed / (5 - 1 cancelled)").isEqualByComparingTo("50.0");
        assertThat(kpis.overdueRate()).as("1 overdue / (5 - 2 completed - 1 cancelled)").isEqualByComparingTo("50.0");
        assertThat(kpis.onTimeCompletionRate()).as("1 on time / 2 completed").isEqualByComparingTo("50.0");
        assertThat(kpis.averageTaskCompletionDays()).isEqualByComparingTo("10.0");
        assertThat(kpis.basis().tasks()).isEqualTo(5);
        assertThat(kpis.basis().completedOnTime()).isEqualTo(1);
    }

    @Test
    void cancelledProjectsAndTasksAreLeftOutOfTheRates() {
        alpha.setStatus("COMPLETED");
        beta.setStatus("CANCELLED");
        task(alpha, "COMPLETED", d(9, 1), d(10, 1), at(9, 30), ana);

        Kpis kpis = service.getKpis("lead.owen", null, TODAY);

        assertThat(kpis.projectCompletionRate()).as("1 / (2 - 1 cancelled)").isEqualByComparingTo("100.0");
        assertThat(kpis.taskCompletionRate()).isEqualByComparingTo("100.0");
    }

    @Test
    void aRateOfNothingIsNull_notZero() {
        Kpis kpis = service.getKpis("lead.owen", null, TODAY);

        assertThat(kpis.taskCompletionRate()).isNull();
        assertThat(kpis.overdueRate()).isNull();
        assertThat(kpis.onTimeCompletionRate()).isNull();
        assertThat(kpis.averageTaskCompletionDays()).isNull();
        assertThat(kpis.projectCompletionRate()).as("two projects, none completed").isEqualByComparingTo("0.0");
    }

    @Test
    void aTaskCompletedBeforeItStarted_countsAsZeroDays_notNegative() {
        task(alpha, "COMPLETED", d(10, 5), d(10, 9), at(10, 2), ana);

        assertThat(service.getKpis("lead.owen", null, TODAY).averageTaskCompletionDays()).isEqualByComparingTo("0.0");
    }

    @Test
    void kpisForOneProject_coverOnlyThatProject() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 1), at(9, 30), ana);
        task(beta, "TODO", d(9, 1), d(10, 1), null, ana);
        when(projectRepository.findByIdIn(List.of(10L, 20L))).thenReturn(List.of(alpha, beta));
        when(taskRepository.findByProjectIdIn(List.of(10L))).thenAnswer(inv -> tasks.stream().filter(t -> t.getProject() == alpha).toList());
        when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L))).thenReturn(List.of());

        Kpis kpis = service.getKpis("lead.owen", 10L, TODAY);

        assertThat(kpis.scope().projects()).isEqualTo(1);
        assertThat(kpis.basis().tasks()).isEqualTo(1);
        assertThat(kpis.taskCompletionRate()).isEqualByComparingTo("100.0");
    }

    // ---- 1. Project Report ------------------------------------------------------------

    @Test
    void theProjectReport_needsAProject() {
        assertThatThrownBy(() -> service.getProjectReport("lead.owen", null, TODAY))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void theProjectReport_holdsDetailsTeamMilestonesCountsAndUpcomingDeadlines() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 1), at(9, 30), ana);
        task(alpha, "IN_PROGRESS", d(10, 1), d(10, 5), null, ben);          // overdue
        task(alpha, "TODO", d(10, 1), d(10, 20), null, ana);                // due in 9 days: upcoming
        task(alpha, "TODO", d(10, 1), d(12, 20), null, ana);                // far away: not upcoming
        task(alpha, "COMPLETED", d(9, 1), d(10, 15), at(9, 30), ana);       // finished: not upcoming
        when(taskRepository.findByProjectIdIn(List.of(10L))).thenAnswer(inv -> tasks.stream().filter(t -> t.getProject() == alpha).toList());
        when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L))).thenAnswer(inv -> assignments);
        ProjectMember member = new ProjectMember();
        member.setUser(ana);
        member.setProjectRole("MEMBER");
        when(projectMemberRepository.findByProjectIdAndStatus(10L, "ACTIVE")).thenReturn(List.of(member));
        Milestone milestone = new Milestone();
        milestone.setTitle("Beta release");
        milestone.setDueDate(d(11, 1));
        milestone.setStatus("PENDING");
        milestone.setProgress(BigDecimal.valueOf(40));
        when(milestoneRepository.findByProjectId(10L)).thenReturn(List.of(milestone));

        ProjectReport report = service.getProjectReport("lead.owen", 10L, TODAY);

        assertThat(report.project().name()).isEqualTo("Alpha");
        assertThat(report.project().owner().getUsername()).isEqualTo("lead.owen");
        assertThat(report.team()).extracting(m -> m.user().getUsername()).containsExactly("dev.ana");
        assertThat(report.milestones()).extracting(MilestoneRow::title).containsExactly("Beta release");
        assertThat(report.taskCounts().total()).isEqualTo(5);
        assertThat(report.taskCounts().completed()).isEqualTo(2);
        assertThat(report.taskCounts().overdue()).isEqualTo(1);
        assertThat(report.upcomingDeadlines()).as("open tasks due within 14 days, soonest first")
                .extracting(TaskRow::dueDate).containsExactly(d(10, 5), d(10, 20));
    }

    // ---- 2. Task Report --------------------------------------------------------------------

    @Test
    void theTaskReport_filtersByAssigneeStatusPriorityAndDueRange() {
        Task a = task(alpha, "TODO", d(10, 1), d(10, 10), null, ana);
        Task b = task(alpha, "IN_PROGRESS", d(10, 1), d(10, 20), null, ben);
        Task c = task(beta, "TODO", d(10, 1), d(11, 20), null, ana);
        b.setPriority("HIGH");

        assertThat(service.getTaskReport("lead.owen", null, null, null, null, null, null, TODAY).rows()).hasSize(3);
        assertThat(service.getTaskReport("lead.owen", null, 2L, null, null, null, null, TODAY).rows())
                .extracting(TaskRow::id).containsExactly(a.getId(), c.getId());
        assertThat(service.getTaskReport("lead.owen", null, null, "IN_PROGRESS", null, null, null, TODAY).rows())
                .extracting(TaskRow::id).containsExactly(b.getId());
        assertThat(service.getTaskReport("lead.owen", null, null, null, "HIGH", null, null, TODAY).rows())
                .extracting(TaskRow::id).containsExactly(b.getId());
        assertThat(service.getTaskReport("lead.owen", null, null, null, null, d(10, 15), d(11, 30), TODAY).rows())
                .extracting(TaskRow::id).containsExactly(b.getId(), c.getId());
    }

    @Test
    void theTaskReport_rowsNameTheAssigneesAndTheProject() {
        task(alpha, "TODO", d(10, 1), d(10, 10), null, ben, ana);

        TaskRow row = service.getTaskReport("lead.owen", null, null, null, null, null, null, TODAY).rows().get(0);

        assertThat(row.assignees()).containsExactly("Ana", "Ben");
        assertThat(row.projectName()).isEqualTo("Alpha");
    }

    @Test
    void badFilters_areRejected() {
        assertThatThrownBy(() -> service.getTaskReport("lead.owen", null, null, "DONE", null, null, null, TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("status");
        assertThatThrownBy(() -> service.getTaskReport("lead.owen", null, null, null, "CRITICAL", null, null, TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("priority");
        assertThatThrownBy(() -> service.getTaskReport("lead.owen", null, null, null, null, d(11, 1), d(10, 1), TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("before its start");
    }

    // ---- 3. Project Status Report ----------------------------------------------------------------

    @Test
    void theProjectStatusReport_groupsByStatus_andDelayedIsADerivedGroup() {
        alpha.setEndDate(d(10, 1)); // still IN_PROGRESS after its end date: delayed
        beta.setStatus("PLANNING");

        ProjectStatusReport report = service.getProjectStatusReport("lead.owen", null, null, null, null, TODAY);

        assertThat(report.groups()).extracting(StatusGroup::key)
                .containsExactly("PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "DELAYED");
        assertThat(group(report, "IN_PROGRESS").projects()).extracting(ProjectRow::name).containsExactly("Alpha");
        assertThat(group(report, "PLANNING").projects()).extracting(ProjectRow::name).containsExactly("Beta");
        assertThat(group(report, "DELAYED").projects()).extracting(ProjectRow::name).containsExactly("Alpha");
        assertThat(group(report, "DELAYED").projects().get(0).daysDelayed()).isEqualTo(10);
    }

    @Test
    void theProjectStatusReport_canShowOneGroup_filterByOwner_andByDateRange() {
        alpha.setEndDate(d(10, 1));
        beta.setStartDate(d(11, 1));
        beta.setEndDate(d(12, 31));

        assertThat(service.getProjectStatusReport("lead.owen", "DELAYED", null, null, null, TODAY).groups())
                .extracting(StatusGroup::key).containsExactly("DELAYED");
        assertThat(service.getProjectStatusReport("lead.owen", null, 999L, null, null, TODAY).groups())
                .allSatisfy(g -> assertThat(g.projects()).isEmpty());
        // only Beta's period overlaps November-December; Alpha ended on 1 October
        ProjectStatusReport november = service.getProjectStatusReport("lead.owen", null, null, d(11, 1), d(12, 31), TODAY);
        assertThat(group(november, "IN_PROGRESS").projects()).extracting(ProjectRow::name).containsExactly("Beta");
        assertThatThrownBy(() -> service.getProjectStatusReport("lead.owen", "ARCHIVED", null, null, null, TODAY))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static StatusGroup group(ProjectStatusReport report, String key) {
        return report.groups().stream().filter(g -> g.key().equals(key)).findFirst().orElseThrow();
    }

    // ---- 4. Task Completion Report ------------------------------------------------------------------

    @Test
    void theCompletionReport_needsADateRange_andAValidGrouping() {
        assertThatThrownBy(() -> service.getTaskCompletionReport("lead.owen", null, "project", null, d(10, 31), TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("date range");
        assertThatThrownBy(() -> service.getTaskCompletionReport("lead.owen", null, "colour", d(10, 1), d(10, 31), TODAY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("groupBy");
    }

    @Test
    void theCompletionReport_byProject_countsTasksDueInTheRange_notCancelledOnes() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 10), at(10, 9), ana);
        task(alpha, "TODO", d(9, 1), d(10, 12), null, ana);
        task(alpha, "COMPLETED", d(9, 1), d(10, 14), at(10, 9), ben);
        task(alpha, "CANCELLED", d(9, 1), d(10, 15), null, ben);          // not counted
        task(beta, "COMPLETED", d(9, 1), d(9, 20), at(9, 19), ana);       // due before the range
        task(beta, "TODO", d(9, 1), d(10, 20), null, ben);

        TaskCompletionReport report = service.getTaskCompletionReport("lead.owen", null, "project", d(10, 1), d(10, 31), TODAY);

        assertThat(report.overall().total()).isEqualTo(4);
        assertThat(report.overall().completed()).isEqualTo(2);
        assertThat(report.overall().percentage()).isEqualByComparingTo("50.0");
        assertThat(report.groups()).extracting(CompletionGroup::label).containsExactly("Alpha", "Beta");
        assertThat(report.groups().get(0).percentage()).as("2 of 3 in Alpha").isEqualByComparingTo("66.7");
        assertThat(report.groups().get(1).percentage()).as("0 of 1 in Beta").isEqualByComparingTo("0.0");
        assertThat(report.completedTasks()).hasSize(2);
    }

    @Test
    void theCompletionReport_byMember_countsATaskForEachAssignee_andListsUnassigned() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 10), at(10, 9), ana, ben);
        task(alpha, "TODO", d(9, 1), d(10, 12), null, ana);
        task(alpha, "TODO", d(9, 1), d(10, 12), null);

        TaskCompletionReport report = service.getTaskCompletionReport("lead.owen", null, "member", d(10, 1), d(10, 31), TODAY);

        assertThat(report.groups()).extracting(CompletionGroup::label).containsExactly("Ana", "Ben", "Unassigned");
        assertThat(report.groups().get(0).total()).isEqualTo(2);
        assertThat(report.groups().get(0).completed()).isEqualTo(1);
        assertThat(report.groups().get(1).percentage()).isEqualByComparingTo("100.0");
        assertThat(report.overall().total()).as("a shared task is one task overall").isEqualTo(3);
    }

    @Test
    void theCompletionReport_byMonth() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 10), at(10, 9), ana);
        task(alpha, "TODO", d(9, 1), d(11, 12), null, ana);

        TaskCompletionReport report = service.getTaskCompletionReport("lead.owen", null, "month", d(10, 1), d(11, 30), TODAY);

        assertThat(report.groups()).extracting(CompletionGroup::label).containsExactly("2026-10", "2026-11");
    }

    // ---- 5. Overdue Task Report -----------------------------------------------------------------------

    @Test
    void theOverdueReport_listsOnlyOverdueTasks_mostOverdueFirst_withDaysOverdue() {
        task(alpha, "TODO", d(9, 1), d(10, 8), null, ana);                // 3 days
        task(alpha, "IN_REVIEW", d(9, 1), d(9, 21), null, ben);           // 20 days
        task(alpha, "COMPLETED", d(9, 1), d(9, 21), at(9, 20), ana);      // finished
        task(alpha, "CANCELLED", d(9, 1), d(9, 21), null, ana);           // cancelled
        task(alpha, "TODO", d(9, 1), d(10, 11), null, ana);               // due today: not overdue

        OverdueReport report = service.getOverdueReport("lead.owen", null, null, null, TODAY);

        assertThat(report.rows()).extracting(TaskRow::daysOverdue).containsExactly(20L, 3L);
        assertThat(report.rows().get(0).status()).isEqualTo("IN_REVIEW");
        assertThat(report.rows().get(0).assignees()).containsExactly("Ben");
    }

    @Test
    void theOverdueReport_filtersByAssigneeAndPriority() {
        Task a = task(alpha, "TODO", d(9, 1), d(10, 8), null, ana);
        Task b = task(alpha, "TODO", d(9, 1), d(10, 8), null, ben);
        b.setPriority("URGENT");

        assertThat(service.getOverdueReport("lead.owen", null, 2L, null, TODAY).rows()).extracting(TaskRow::id).containsExactly(a.getId());
        assertThat(service.getOverdueReport("lead.owen", null, null, "URGENT", TODAY).rows()).extracting(TaskRow::id).containsExactly(b.getId());
    }

    // ---- 6. Team Performance Report ---------------------------------------------------------------------------

    @Test
    void theTeamPerformanceReport_countsEachMembersTasks_andTheCompletionRate() {
        task(alpha, "COMPLETED", d(9, 1), d(10, 1), at(9, 30), ana);
        task(alpha, "TODO", d(9, 1), d(10, 5), null, ana);                // overdue
        task(alpha, "IN_PROGRESS", d(9, 1), d(11, 5), null, ana);
        task(alpha, "IN_REVIEW", d(9, 1), d(11, 5), null, ana);
        task(alpha, "CANCELLED", d(9, 1), d(10, 5), null, ana);           // left out
        task(beta, "COMPLETED", d(9, 1), d(10, 1), at(9, 30), ben);

        TeamPerformanceReport report = service.getTeamPerformanceReport("lead.owen", null, null, null, TODAY);

        MemberPerformance anaRow = report.members().get(0);
        assertThat(anaRow.user().getUsername()).isEqualTo("dev.ana");
        assertThat(anaRow.assigned()).isEqualTo(4);
        assertThat(anaRow.completed()).isEqualTo(1);
        assertThat(anaRow.todo()).isEqualTo(1);
        assertThat(anaRow.inProgress()).isEqualTo(1);
        assertThat(anaRow.inReview()).isEqualTo(1);
        assertThat(anaRow.overdue()).isEqualTo(1);
        assertThat(anaRow.completionRate()).isEqualByComparingTo("25.0");
        assertThat(report.members().get(1).completionRate()).isEqualByComparingTo("100.0");
    }

    @Test
    void theTeamPerformanceReport_respectsTheDateRange() {
        task(alpha, "COMPLETED", d(9, 1), d(9, 10), at(9, 9), ana);
        task(alpha, "TODO", d(9, 1), d(10, 20), null, ana);

        TeamPerformanceReport report = service.getTeamPerformanceReport("lead.owen", null, d(10, 1), d(10, 31), TODAY);

        assertThat(report.members().get(0).assigned()).isEqualTo(1);
        assertThat(report.members().get(0).completionRate()).isEqualByComparingTo("0.0");
    }

    // ---- 7. Workload Report --------------------------------------------------------------------------------------

    @Test
    void theWorkloadReport_usesTheSameWorkloadAsTheTeamView_forTheReportableProjects() {
        TeamViewsResponse.Workload workload = new TeamViewsResponse.Workload(null, null, 0, BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        when(teamViewsService.buildWorkload(eq(List.of(10L, 20L)), eq(null), eq(null), any(LocalDate.class))).thenReturn(workload);

        WorkloadReport report = service.getWorkloadReport("lead.owen", null, TODAY);

        assertThat(report.workload()).isSameAs(workload);
        verify(teamViewsService).buildWorkload(List.of(10L, 20L), null, null, TODAY);
    }
}
