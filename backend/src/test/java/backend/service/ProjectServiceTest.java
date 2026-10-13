package backend.service;

import backend.dto.ProjectRequest;
import backend.dto.PageResponse;
import backend.dto.ProjectResponse;
import backend.entity.Project;
import backend.entity.User;
import backend.exception.ConflictException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.PageParams;
import backend.util.ProjectListQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private ProjectOwnership projectOwnership;
    @Mock
    private UpdateNotificationService updateNotificationService;

    @Mock
    private AuditLogService auditLogService;

    private ProjectService projectService;

    private User caller;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(projectRepository, projectMemberRepository, userRepository, projectAccessGuard, projectOwnership, activityLogService, updateNotificationService, auditLogService);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 7L);
        caller.setUsername("pm.olivia");
        when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
    }

    private ProjectRequest request(String code) {
        ProjectRequest r = new ProjectRequest();
        r.setProjectCode(code);
        r.setName("Demo");
        r.setStartDate(LocalDate.of(2026, 10, 1));
        r.setEndDate(LocalDate.of(2026, 12, 31));
        return r;
    }

    private Project existingProject() {
        Project existing = new Project();
        ReflectionTestUtils.setField(existing, "id", 5L);
        existing.setProjectCode("PRJ-2005");
        existing.setManager(caller);
        return existing;
    }

    private void stubSave() {
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void create_makesTheCreatorTheProjectsOwner() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        projectService.createProject(request(null), "pm.olivia");

        verify(projectOwnership).assignOwner(any(Project.class), org.mockito.ArgumentMatchers.eq(caller));
    }

    @Test
    void update_keepsTheOwnerInStepWithTheManager() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia");

        verify(projectOwnership).assignOwner(any(Project.class), org.mockito.ArgumentMatchers.eq(caller));
    }

    @Test
    void create_withACodeThatAlreadyExists_isRejectedWith409AndNothingIsSaved() {
        when(projectRepository.existsByProjectCode("PRJ-2001")).thenReturn(true);

        assertThatThrownBy(() -> projectService.createProject(request("PRJ-2001"), "pm.olivia"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Project code already exists.");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void create_trimsTheCodeBeforeCheckingAndSaving() {
        when(projectRepository.existsByProjectCode("WEB-RD")).thenReturn(false);
        stubSave();

        ProjectResponse response = projectService.createProject(request("  WEB-RD  "), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("WEB-RD");
    }

    @Test
    void create_withoutACode_generatesTheNextPrjNumber() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of("PRJ-2001", "PRJ-2010", "PRJ-0003"));
        stubSave();

        ProjectResponse response = projectService.createProject(request(null), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-2011");
    }

    @Test
    void create_withoutACode_takesTheCodeLockBeforeReadingTheCodesInUse() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        projectService.createProject(request(null), "pm.olivia");

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(projectRepository);
        order.verify(projectRepository).lockProjectCodeGeneration();
        order.verify(projectRepository).findAutoProjectCodes();
    }

    @Test
    void create_withAChosenCode_doesNotNeedTheCodeLock() {
        stubSave();

        projectService.createProject(request("WEB-RD"), "pm.olivia");

        verify(projectRepository, never()).lockProjectCodeGeneration();
    }

    @Test
    void create_withABlankCode_isTreatedAsNoCode() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        ProjectResponse response = projectService.createProject(request("   "), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-0001");
        verify(projectRepository, never()).existsByProjectCode(any());
    }

    @Test
    void update_toACodeUsedByAnotherProject_isRejectedWith409() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2001", 5L)).thenReturn(true);

        assertThatThrownBy(() -> projectService.updateProject(5L, request("PRJ-2001"), "pm.olivia"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Project code already exists.");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void update_keepingItsOwnCode_isAllowed() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        ProjectResponse response = projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-2005");
    }

    @Test
    void update_withABlankCode_keepsTheExistingOne() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        stubSave();

        ProjectResponse response = projectService.updateProject(5L, request(null), "pm.olivia");

        ArgumentCaptor<Project> saved = ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(saved.capture());
        assertThat(saved.getValue().getProjectCode()).isEqualTo("PRJ-2005");
        assertThat(response.getProjectCode()).isEqualTo("PRJ-2005");
    }

    @Test
    void create_needsTheSystemPermissionToCreateProjects_andSavesNothingWithout() {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException(
                        "Only a Project Manager or an Administrator can create a project"))
                .when(projectAccessGuard).assertSystemCan(caller, Resource.PROJECT, Action.CREATE);

        assertThatThrownBy(() -> projectService.createProject(request("WEB-RD"), "pm.olivia"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class)
                .hasMessageContaining("Project Manager");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void update_needsProjectEdit_andDelete_needsProjectDelete() {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("no"))
                .when(projectAccessGuard).assertCan(caller, 5L, Resource.PROJECT, Action.EDIT);
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("no"))
                .when(projectAccessGuard).assertCan(caller, 5L, Resource.PROJECT, Action.DELETE);

        assertThatThrownBy(() -> projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> projectService.deleteProject(5L, "pm.olivia"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(projectRepository, never()).save(any());
        verify(projectRepository, never()).delete(any());
    }

    // ---- the project feed ---------------------------------------------------

    @Test
    void creatingAProject_isLoggedInItsActivityFeed() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        projectService.createProject(request(null), "pm.olivia");

        verify(activityLogService).recordProjectEvent(
                org.mockito.ArgumentMatchers.eq(caller), any(Project.class),
                org.mockito.ArgumentMatchers.eq("PROJECT_CREATED"), org.mockito.ArgumentMatchers.contains("Demo"));
    }

    @Test
    void editingAProject_logsWhatChanged() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        // the stored project has no name or dates, the request sets them
        projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia");

        verify(activityLogService).recordProjectEvent(
                org.mockito.ArgumentMatchers.eq(caller), any(Project.class),
                org.mockito.ArgumentMatchers.eq("PROJECT_UPDATED"), org.mockito.ArgumentMatchers.contains("name"));
    }

    @Test
    void savingAProjectWithoutChanges_logsNothing() {
        Project existing = existingProject();
        ProjectRequest same = request("PRJ-2005");
        existing.setName(same.getName());
        existing.setStartDate(same.getStartDate());
        existing.setEndDate(same.getEndDate());
        existing.setDescription(same.getDescription());
        existing.setPriority(same.getPriority() != null ? same.getPriority() : existing.getPriority());
        existing.setStatus(same.getStatus() != null ? same.getStatus() : existing.getStatus());
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        projectService.updateProject(5L, same, "pm.olivia");

        verify(activityLogService, never()).recordProjectEvent(any(), any(), any(), any());
        verify(updateNotificationService, never()).notifyProjectUpdated(any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any());
    }

    // ---- notifications ------------------------------------------------------

    @Test
    void editingAProject_tellsThePeopleAroundItWhatChanged() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia");

        verify(updateNotificationService).notifyProjectUpdated(
                any(Project.class), org.mockito.ArgumentMatchers.eq(caller), org.mockito.ArgumentMatchers.eq(false),
                org.mockito.ArgumentMatchers.argThat(changed -> changed.contains("name")));
    }

    @Test
    void completingAProject_isAnnouncedAsCompleted() {
        Project existing = existingProject();
        existing.setStatus("IN_PROGRESS");
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();
        ProjectRequest done = request("PRJ-2005");
        done.setStatus("COMPLETED");

        projectService.updateProject(5L, done, "pm.olivia");

        verify(updateNotificationService).notifyProjectUpdated(
                any(Project.class), org.mockito.ArgumentMatchers.eq(caller), org.mockito.ArgumentMatchers.eq(true),
                org.mockito.ArgumentMatchers.argThat(changed -> changed.contains("status")));
    }

    @Test
    void creatingAProject_notifiesNobody() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        projectService.createProject(request(null), "pm.olivia");

        verify(updateNotificationService, never()).notifyProjectUpdated(any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any());
    }

    @Test
    void completingAProject_isLoggedOnItsOwn() {
        Project existing = existingProject();
        existing.setName("Demo");
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();
        ProjectRequest done = request("PRJ-2005");
        done.setStatus("COMPLETED");

        projectService.updateProject(5L, done, "pm.olivia");

        verify(activityLogService).recordProjectEvent(
                org.mockito.ArgumentMatchers.eq(caller), any(Project.class),
                org.mockito.ArgumentMatchers.eq("PROJECT_COMPLETED"), any());
    }

    // ---- the project lead (V15, D-09) -------------------------------------------

    private User teamLeader(Long id, boolean activeTeamLeader) {
        User leader = new User();
        ReflectionTestUtils.setField(leader, "id", id);
        leader.setUsername("lead." + id);
        leader.setFullName("Lead " + id);
        backend.entity.ProjectMember row = new backend.entity.ProjectMember();
        row.setUser(leader);
        row.setProjectRole(activeTeamLeader ? "ADMIN" : "MEMBER");
        row.setStatus("ACTIVE");
        when(userRepository.findById(id)).thenReturn(Optional.of(leader));
        when(projectMemberRepository.findByProjectIdAndUserId(5L, id)).thenReturn(Optional.of(row));
        return leader;
    }

    @Test
    void setLead_namesATeamLeaderOfTheProject_andLogsIt() {
        Project project = existingProject();
        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        User leader = teamLeader(9L, true);
        stubSave();

        ProjectResponse response = projectService.setLead(5L, 9L, "pm.olivia");

        assertThat(project.getLead()).isSameAs(leader);
        assertThat(response.getLead().getId()).isEqualTo(9L);
        verify(projectAccessGuard).assertCan(caller, 5L, Resource.PROJECT, Action.ASSIGN);
        verify(activityLogService).recordProjectEvent(caller, project, "PROJECT_LEAD_CHANGED", "Lead 9 was named the project lead");
    }

    @Test
    void setLead_refusesSomeoneWhoIsNotATeamLeaderOfThisProject() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        teamLeader(9L, false);

        assertThatThrownBy(() -> projectService.setLead(5L, 9L, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only a Team Leader can be its lead");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void setLead_withNoUser_clearsTheLead() {
        Project project = existingProject();
        project.setLead(caller);
        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        stubSave();

        ProjectResponse response = projectService.setLead(5L, null, "pm.olivia");

        assertThat(project.getLead()).isNull();
        assertThat(response.getLead()).isNull();
        verify(activityLogService).recordProjectEvent(caller, project, "PROJECT_LEAD_CHANGED", "The project lead was cleared");
    }

    @Test
    void setLead_toTheSamePerson_changesAndLogsNothing() {
        Project project = existingProject();
        User leader = teamLeader(9L, true);
        project.setLead(leader);
        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));

        projectService.setLead(5L, 9L, "pm.olivia");

        verify(projectRepository, never()).save(any());
        verify(activityLogService, never()).recordProjectEvent(any(), any(), any(), any());
    }

    @Test
    void setLead_needsThePermissionToAssign() {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("no"))
                .when(projectAccessGuard).assertCan(caller, 5L, Resource.PROJECT, Action.ASSIGN);

        assertThatThrownBy(() -> projectService.setLead(5L, 9L, "pm.olivia"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(projectRepository, never()).save(any());
    }

    // ---- the audit log (#44) ---------------------------------------------------------

    @Test
    void deletingAProject_isAudited_beforeItIsGone() {
        Project project = existingProject();
        project.setName("Website");
        project.setStatus("IN_PROGRESS");
        caller.setFullName("Olivia Bennett");
        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));

        projectService.deleteProject(5L, "pm.olivia");

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(auditLogService, projectRepository);
        order.verify(auditLogService).record(AuditLogService.PROJECT_DELETED, AuditLogService.PROJECT, 5L,
                "PRJ-2005 Website", null, "IN_PROGRESS, managed by Olivia Bennett", null);
        order.verify(projectRepository).delete(project);
    }

    @Test
    void getAllProjects_aSearchOnlyNarrowsTheProjectsTheCallerIsAMemberOf() {
        Project mine = existingProject();
        mine.setName("Apollo");
        mine.setStatus("IN_PROGRESS");
        mine.setStartDate(LocalDate.of(2026, 10, 1));
        mine.setEndDate(LocalDate.of(2026, 12, 31));
        when(projectMemberRepository.findProjectIdsByUserId(7L)).thenReturn(List.of(5L));
        when(projectRepository.findByIdIn(List.of(5L))).thenReturn(List.of(mine));

        // A project the caller is not a member of is never loaded, so no query can find it.
        List<ProjectResponse> found = projectService.getAllProjects("pm.olivia",
                new ProjectListQuery(null, null, null, null, null));
        List<ProjectResponse> narrowed = projectService.getAllProjects("pm.olivia",
                new ProjectListQuery("zzz", null, null, null, null));

        assertThat(found).extracting(ProjectResponse::getName).containsExactly("Apollo");
        assertThat(narrowed).isEmpty();
        verify(projectRepository, never()).findAll();
    }

    // ---- one page at a time (risk R-5) ---------------------------------------

    private Project projectWithId(Long id, String name) {
        Project p = existingProject();
        org.springframework.test.util.ReflectionTestUtils.setField(p, "id", id);
        p.setName(name);
        p.setStatus("IN_PROGRESS");
        return p;
    }

    @Test
    void getProjectsPage_cutsTheMatchingProjectsIntoPagesInIdOrderWithTheTotalOfAll() {
        when(projectMemberRepository.findProjectIdsByUserId(7L)).thenReturn(List.of(9L, 5L, 7L));
        // the repository answers in no particular order; a page must still be the same page every time
        when(projectRepository.findByIdIn(List.of(9L, 5L, 7L)))
                .thenReturn(List.of(projectWithId(9L, "Nine"), projectWithId(5L, "Five"), projectWithId(7L, "Seven")));

        ProjectListQuery all = new ProjectListQuery(null, null, null, null, null);
        PageResponse<ProjectResponse> first = projectService.getProjectsPage("pm.olivia", all, PageParams.of(0, 2));
        PageResponse<ProjectResponse> second = projectService.getProjectsPage("pm.olivia", all, PageParams.of(1, 2));
        PageResponse<ProjectResponse> beyond = projectService.getProjectsPage("pm.olivia", all, PageParams.of(5, 2));

        assertThat(first.getItems()).extracting(ProjectResponse::getId).containsExactly(5L, 7L);
        assertThat(second.getItems()).extracting(ProjectResponse::getId).containsExactly(9L);
        assertThat(first.getTotal()).isEqualTo(3);
        assertThat(beyond.getItems()).isEmpty();
        assertThat(beyond.getTotal()).isEqualTo(3);
    }

    @Test
    void getProjectsPage_theTotalCountsOnlyWhatMatchesTheQueryAndNeverWhatTheCallerCannotSee() {
        when(projectMemberRepository.findProjectIdsByUserId(7L)).thenReturn(List.of(5L, 7L));
        when(projectRepository.findByIdIn(List.of(5L, 7L)))
                .thenReturn(List.of(projectWithId(5L, "Apollo"), projectWithId(7L, "Borealis")));

        PageResponse<ProjectResponse> page = projectService.getProjectsPage("pm.olivia",
                new ProjectListQuery("apollo", null, null, null, "name"), PageParams.of(0, 10));

        assertThat(page.getItems()).extracting(ProjectResponse::getName).containsExactly("Apollo");
        assertThat(page.getTotal()).isEqualTo(1);
        verify(projectRepository, never()).findAll();
    }
}
