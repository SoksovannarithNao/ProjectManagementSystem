package backend.service;

import backend.dto.TeamViewsResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

// Team Tasks and Team Workload (assignment-brief.md Part A, flows 22 and 30, D-13).
@ExtendWith(MockitoExtension.class)
class TeamViewsServiceTest {

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
    private WorkLogRepository workLogRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private TeamViewsService service;
    private User leader;
    private User ana;
    private User ben;
    private User cam;
    private Project project;
    private final List<Task> tasks = new ArrayList<>();
    private final List<TaskAssignee> assignments = new ArrayList<>();
    private long nextId = 100;

    @BeforeEach
    void setUp() {
        service = new TeamViewsService(projectRepository, projectMemberRepository, taskRepository,
                taskAssigneeRepository, workLogRepository, userRepository, projectAccessGuard);
        leader = user(1L, "lead.owen", "Owen Leader");
        ana = user(2L, "dev.ana", "Ana");
        ben = user(3L, "dev.ben", "Ben");
        cam = user(4L, "dev.cam", "Cam");
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setName("Website Redesign");
        lenient().when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        lenient().when(projectAccessGuard.can(leader, 10L, Resource.TASK, Action.ASSIGN)).thenReturn(true);
        lenient().when(taskRepository.findByProjectIdIn(List.of(10L))).thenAnswer(inv -> tasks);
        lenient().when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L))).thenAnswer(inv -> assignments);
        lenient().when(workLogRepository.sumHoursByUserForProjects(List.of(10L))).thenReturn(List.of());
        members(member(ana, "MEMBER"), member(ben, "MEMBER"), member(cam, "MEMBER"), member(leader, "ADMIN"));
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

    private ProjectMember member(User u, String role) {
        ProjectMember m = new ProjectMember();
        m.setProject(project);
        m.setUser(u);
        m.setProjectRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    private void members(ProjectMember... all) {
        lenient().when(projectMemberRepository.findByProjectIdIn(List.of(10L))).thenReturn(List.of(all));
    }

    private Task task(String status, LocalDate due, double estimated, int progress, User... assignees) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", nextId++);
        t.setProject(project);
        t.setTitle("Task " + t.getId());
        t.setStatus(status);
        t.setPriority("MEDIUM");
        t.setStartDate(TODAY.minusDays(20));
        t.setDueDate(due);
        t.setEstimatedHours(BigDecimal.valueOf(estimated));
        t.setProgress(BigDecimal.valueOf(progress));
        tasks.add(t);
        for (User u : assignees) {
            TaskAssignee ta = new TaskAssignee();
            ReflectionTestUtils.setField(ta, "id", nextId++);
            ta.setTask(t);
            ta.setUser(u);
            assignments.add(ta);
        }
        return t;
    }

    // ---- Team Tasks ------------------------------------------------------------

    @Test
    void teamTasks_groupsTheTasksByMember_withCountsAndProgress() {
        task("COMPLETED", TODAY.minusDays(3), 4, 100, ana);
        task("IN_PROGRESS", TODAY.plusDays(4), 8, 50, ana);
        task("TODO", TODAY.minusDays(2), 2, 0, ana);
        task("IN_PROGRESS", TODAY.plusDays(9), 6, 30, ben);

        TeamViewsResponse.TeamTasks result = service.getTeamTasks(10L, "lead.owen", TODAY);

        assertThat(result.projectName()).isEqualTo("Website Redesign");
        TeamViewsResponse.MemberTasks anaTasks = result.members().stream()
                .filter(m -> m.user().getUsername().equals("dev.ana")).findFirst().orElseThrow();
        assertThat(anaTasks.assigned()).isEqualTo(3);
        assertThat(anaTasks.completed()).isEqualTo(1);
        assertThat(anaTasks.active()).isEqualTo(1);
        assertThat(anaTasks.overdue()).as("the TODO task is past due, the completed one is not").isEqualTo(1);
        assertThat(anaTasks.averageProgress()).isEqualByComparingTo("50.0");
        assertThat(anaTasks.tasks()).hasSize(3);
        assertThat(anaTasks.tasks().get(anaTasks.tasks().size() - 1).status())
                .as("finished work goes last").isEqualTo("COMPLETED");
        assertThat(anaTasks.tasks()).allSatisfy(t -> assertThat(t.assignmentId()).isNotNull());
    }

    @Test
    void teamTasks_listsMembersInNameOrder_includingThoseWithNoWork_butNotViewers() {
        members(member(cam, "MEMBER"), member(ana, "MEMBER"), member(user(9L, "qa.zoe", "Zoe"), "VIEWER"));

        List<String> names = service.getTeamTasks(10L, "lead.owen", TODAY).members().stream()
                .map(m -> m.user().getFullName()).toList();

        assertThat(names).containsExactly("Ana", "Cam");
    }

    @Test
    void teamTasks_showsTasksNobodyHasYet_butNotCancelledOnes() {
        task("TODO", TODAY.plusDays(5), 3, 0);
        task("CANCELLED", TODAY.plusDays(5), 3, 0);
        task("TODO", TODAY.plusDays(2), 3, 0, ana);

        TeamViewsResponse.TeamTasks result = service.getTeamTasks(10L, "lead.owen", TODAY);

        assertThat(result.unassigned()).hasSize(1);
        assertThat(result.unassigned().get(0).assignmentId()).isNull();
    }

    @Test
    void teamTasks_leavesOutCancelledTasksOfAMember() {
        task("CANCELLED", TODAY.plusDays(5), 3, 0, ana);
        // the repository already filters on the task, but a cancelled assignment is also ignored
        TeamViewsResponse.TeamTasks result = service.getTeamTasks(10L, "lead.owen", TODAY);

        assertThat(result.members().stream().filter(m -> m.user().getUsername().equals("dev.ana")).findFirst().orElseThrow()
                .assigned()).isZero();
    }

    @Test
    void teamTasks_areForPeopleWhoCanAssign_notForMembers() {
        when(projectAccessGuard.can(ana, 10L, Resource.TASK, Action.ASSIGN)).thenReturn(false);

        assertThatThrownBy(() -> service.getTeamTasks(10L, "dev.ana", TODAY))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Owner, a Team Leader or an Administrator");
    }

    @Test
    void teamTasks_ofAProjectYouCannotSee_looksLikeAMissingProject() {
        doThrow(new NotFoundException("Project not found")).when(projectAccessGuard).assertAccess(ben, 10L);

        assertThatThrownBy(() -> service.getTeamTasks(10L, "dev.ben", TODAY)).isInstanceOf(NotFoundException.class);
    }

    // ---- Workload ----------------------------------------------------------------

    @Test
    void workload_countsAssignedActiveOverdueAndHours_perMember() {
        task("COMPLETED", TODAY.minusDays(3), 4, 100, ana);          // assigned, finished: no hours left
        task("IN_PROGRESS", TODAY.plusDays(4), 8, 50, ana);          // active, 8 h
        task("TODO", TODAY.minusDays(2), 2, 0, ana);                 // overdue, 2 h
        task("CANCELLED", TODAY.minusDays(2), 20, 0, ana);           // not counted at all
        when(workLogRepository.sumHoursByUserForProjects(List.of(10L)))
                .thenReturn(List.of(hours(2L, "7.5")));

        TeamViewsResponse.MemberWorkload row = service.getWorkload(10L, "lead.owen", TODAY).members().stream()
                .filter(m -> m.user().getUsername().equals("dev.ana")).findFirst().orElseThrow();

        assertThat(row.assigned()).isEqualTo(3);
        assertThat(row.active()).isEqualTo(1);
        assertThat(row.overdue()).isEqualTo(1);
        assertThat(row.estimatedHours()).as("of the tasks not yet completed or cancelled").isEqualByComparingTo("10");
        assertThat(row.actualHours()).isEqualByComparingTo("7.5");
    }

    @Test
    void workload_marksTheOverloadedAndUnderloaded_againstTheTeamAverage() {
        for (int i = 0; i < 6; i++) {
            task("IN_PROGRESS", TODAY.plusDays(3), 1, 10, ana);
        }
        task("IN_PROGRESS", TODAY.plusDays(3), 1, 10, ben);
        task("IN_PROGRESS", TODAY.plusDays(3), 1, 10, ben);
        // cam has nothing; the leader has nothing either (and manages rather than carries load)
        TeamViewsResponse.Workload result = service.getWorkload(10L, "lead.owen", TODAY);

        assertThat(result.teamSize()).as("the leader has no tasks, so is not part of the comparison").isEqualTo(3);
        assertThat(result.averageOpenTasks()).isEqualByComparingTo("2.67");
        assertThat(level(result, "dev.ana")).isEqualTo("OVERLOADED");
        assertThat(level(result, "dev.ben")).isEqualTo("BALANCED");
        assertThat(level(result, "dev.cam")).isEqualTo("UNDERLOADED");
    }

    @Test
    void workload_listsAnOwnerOrLeader_onlyOnceWorkIsAssignedToThem() {
        assertThat(service.getWorkload(10L, "lead.owen", TODAY).members())
                .extracting(m -> m.user().getUsername()).doesNotContain("lead.owen");

        task("IN_PROGRESS", TODAY.plusDays(3), 5, 10, leader);

        assertThat(service.getWorkload(10L, "lead.owen", TODAY).members())
                .extracting(m -> m.user().getUsername()).contains("lead.owen");
    }

    @Test
    void workload_ofAOnePersonTeam_comparesNoOne() {
        members(member(ana, "MEMBER"));
        task("IN_PROGRESS", TODAY.plusDays(3), 40, 10, ana);

        assertThat(level(service.getWorkload(10L, "lead.owen", TODAY), "dev.ana")).isEqualTo("BALANCED");
    }

    @Test
    void workload_isForPeopleWhoCanAssign() {
        when(projectAccessGuard.can(ana, 10L, Resource.TASK, Action.ASSIGN)).thenReturn(false);

        assertThatThrownBy(() -> service.getWorkload(10L, "dev.ana", TODAY)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void workloadAcrossProjects_coversOnlyTheProjectsTheCallerManages() {
        when(projectAccessGuard.isAdmin(leader)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L, 20L));
        when(projectAccessGuard.can(leader, 20L, Resource.TASK, Action.ASSIGN)).thenReturn(false);
        task("IN_PROGRESS", TODAY.plusDays(3), 5, 10, ana);

        TeamViewsResponse.Workload result = service.getWorkload(null, "lead.owen", TODAY);

        assertThat(result.projectId()).isNull();
        assertThat(result.members()).extracting(m -> m.user().getUsername()).contains("dev.ana");
    }

    @Test
    void workloadAcrossProjects_isRefusedToSomeoneWhoManagesNone() {
        when(projectAccessGuard.isAdmin(ana)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(2L)).thenReturn(List.of(10L));
        when(projectAccessGuard.can(ana, 10L, Resource.TASK, Action.ASSIGN)).thenReturn(false);

        assertThatThrownBy(() -> service.getWorkload(null, "dev.ana", TODAY))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Owner, a Team Leader or an Administrator");
    }

    private static String level(TeamViewsResponse.Workload workload, String username) {
        return workload.members().stream().filter(m -> m.user().getUsername().equals(username)).findFirst().orElseThrow().level();
    }

    private static WorkLogRepository.UserHours hours(Long userId, String value) {
        return new WorkLogRepository.UserHours() {
            public Long getUserId() { return userId; }
            public BigDecimal getHours() { return new BigDecimal(value); }
        };
    }
}
