package backend.service;

import backend.dto.InvitableUserResponse;
import backend.dto.PendingInvitationCountResponse;
import backend.dto.ProjectMemberRequest;
import backend.dto.TeamInviteRequest;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectMemberServiceTest {

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectAccessGuard projectAccessGuard;

    @Mock
    private NotificationService notificationService;

    private ProjectMemberService service;

    private User caller;

    @BeforeEach
    void setUp() {
        // the real ownership helper over the mocked repositories, so a transfer is tested end to end
        service = new ProjectMemberService(
                projectMemberRepository, projectRepository, userRepository, projectAccessGuard, notificationService,
                new ProjectOwnership(projectMemberRepository, projectRepository));
        caller = user(1L, "pm.olivia", "ACTIVE");
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setManager(caller);
        // lenient: pure helper tests (likePattern) don't touch these.
        lenient().when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
        lenient().when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        // by default the caller is the project Owner; the role-rule tests below change that
        lenient().when(projectAccessGuard.activeRole(caller, 10L)).thenReturn(Optional.of("OWNER"));
    }

    private static User user(Long id, String username, String status) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(username + " full");
        u.setAccountStatus(status);
        return u;
    }

    private TeamInviteRequest invite(String username) {
        TeamInviteRequest r = new TeamInviteRequest();
        r.setProjectId(10L);
        r.setUsername(username);
        return r;
    }

    // ---- INACTIVE / SUSPENDED users are not eligible -------------------

    @ParameterizedTest
    @ValueSource(strings = {"INACTIVE", "SUSPENDED"})
    void invite_rejectsAccountsThatAreNotActive(String status) {
        User target = user(2L, "contractor.felix", status);
        when(userRepository.findByUsernameIgnoreCase("contractor.felix")).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.inviteMember(invite("contractor.felix"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inactive account");
        verify(projectMemberRepository, never()).save(any());
        verify(notificationService, never()).notifyTeamInvitation(any(), any());
    }

    @Test
    void invite_stillAllowsActiveAccounts() {
        User target = user(2L, "dev.chen", "ACTIVE");
        when(userRepository.findByUsernameIgnoreCase("dev.chen")).thenReturn(Optional.of(target));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 2L)).thenReturn(Optional.empty());
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.inviteMember(invite("dev.chen"), "pm.olivia");

        ArgumentCaptor<ProjectMember> saved = ArgumentCaptor.forClass(ProjectMember.class);
        verify(projectMemberRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("PENDING");
        assertThat(saved.getValue().getProjectRole()).isEqualTo("MEMBER");
        verify(notificationService).notifyTeamInvitation(any(), eq(caller));
    }

    @Test
    void invite_stillRequiresPermissionToManageTheProject() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCan(caller, 10L, Resource.MEMBER, Action.CREATE);

        assertThatThrownBy(() -> service.inviteMember(invite("dev.chen"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(userRepository, never()).findByUsernameIgnoreCase(anyString());
    }

    @Test
    void invite_appliesTheChosenProjectRole() {
        User target = user(2L, "dev.chen", "ACTIVE");
        when(userRepository.findByUsernameIgnoreCase("dev.chen")).thenReturn(Optional.of(target));
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 2L)).thenReturn(Optional.empty());
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));
        TeamInviteRequest request = invite("dev.chen");
        request.setProjectRole("VIEWER");

        service.inviteMember(request, "pm.olivia");

        ArgumentCaptor<ProjectMember> saved = ArgumentCaptor.forClass(ProjectMember.class);
        verify(projectMemberRepository).save(saved.capture());
        assertThat(saved.getValue().getProjectRole()).isEqualTo("VIEWER");
        verify(projectAccessGuard, never()).assertCan(any(), any(), eq(Resource.PROJECT), eq(Action.ASSIGN));
    }

    @Test
    void invite_asOwner_isRefused_ownershipIsTransferredNotInvited() {
        User target = user(2L, "dev.chen", "ACTIVE");
        when(userRepository.findByUsernameIgnoreCase("dev.chen")).thenReturn(Optional.of(target));
        TeamInviteRequest request = invite("dev.chen");
        request.setProjectRole("OWNER");

        assertThatThrownBy(() -> service.inviteMember(request, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly one owner");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void directAdd_asOwner_isRefused() {
        assertThatThrownBy(() -> service.createProjectMember(memberRequest(10L, 2L, "OWNER"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactly one owner");
        verify(projectMemberRepository, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"INACTIVE", "SUSPENDED"})
    void directAdd_rejectsAccountsThatAreNotActive(String status) {
        User target = user(2L, "exemployee.diego", status);
        when(userRepository.findById(2L)).thenReturn(Optional.of(target));
        ProjectMemberRequest request = new ProjectMemberRequest();
        request.setProjectId(10L);
        request.setUserId(2L);
        request.setProjectRole("MEMBER");

        assertThatThrownBy(() -> service.createProjectMember(request, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inactive account");
        verify(projectMemberRepository, never()).save(any());
    }

    // ---- pending invitation count --------------------------------------

    @Test
    void pendingCount_comesFromThePendingStatusQuery_notFromTheActiveMemberList() {
        when(projectMemberRepository.countByProjectIdAndStatus(10L, "PENDING")).thenReturn(3L);

        PendingInvitationCountResponse response = service.countPendingInvitations(10L, "pm.olivia");

        assertThat(response.count()).isEqualTo(3L);
        verify(projectAccessGuard).assertCan(caller, 10L, Resource.MEMBER, Action.CREATE);
        verify(projectMemberRepository, never()).findByProjectIdAndStatus(any(), eq("ACTIVE"));
    }

    @Test
    void pendingCount_isTeamAdminOnly() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCan(caller, 10L, Resource.MEMBER, Action.CREATE);

        assertThatThrownBy(() -> service.countPendingInvitations(10L, "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(projectMemberRepository, never()).countByProjectIdAndStatus(any(), any());
    }

    // ---- invitable-user search ------------------------------------------

    @Test
    void search_queriesTheWholeOrgInTheDatabase_andMapsToTheNarrowDto() {
        User found = user(5L, "newuser", "ACTIVE");
        when(userRepository.findInvitableUsers(eq(10L), eq(1L), eq("%new%"), any(Pageable.class)))
                .thenReturn(List.of(found));

        List<InvitableUserResponse> result = service.searchInvitableUsers(10L, "  NeW ", 10, "pm.olivia");

        assertThat(result).extracting(InvitableUserResponse::username).containsExactly("newuser");
        verify(projectAccessGuard).assertCan(caller, 10L, Resource.MEMBER, Action.CREATE);
        // never loads the full directory to filter in memory
        verify(userRepository, never()).findAllWithRoles();
    }

    @Test
    void search_clampsThePageSize() {
        when(userRepository.findInvitableUsers(any(), any(), any(), any())).thenReturn(List.of());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);

        service.searchInvitableUsers(10L, "a", 500, "pm.olivia");
        service.searchInvitableUsers(10L, "a", 0, "pm.olivia");

        verify(userRepository, times(2)).findInvitableUsers(any(), any(), any(), page.capture());
        assertThat(page.getAllValues().get(0).getPageSize()).isEqualTo(ProjectMemberService.INVITABLE_MAX_RESULTS);
        assertThat(page.getAllValues().get(1).getPageSize()).isEqualTo(1);
    }

    @Test
    void search_isTeamAdminOnly() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCan(caller, 10L, Resource.MEMBER, Action.CREATE);

        assertThatThrownBy(() -> service.searchInvitableUsers(10L, "a", 10, "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(userRepository, never()).findInvitableUsers(any(), any(), any(), any());
    }

    @Test
    void likePattern_lowercasesTrimsAndEscapesWildcards() {
        assertThat(ProjectMemberService.likePattern("  Olivia ")).isEqualTo("%olivia%");
        assertThat(ProjectMemberService.likePattern(null)).isEqualTo("%%");
        assertThat(ProjectMemberService.likePattern("a_b%c!d")).isEqualTo("%a!_b!%c!!d%");
    }

    // ---- membership lookups and updates stay inside the caller's projects ----

    private ProjectMember row(Long id, Project project, User user, String status) {
        ProjectMember m = new ProjectMember();
        ReflectionTestUtils.setField(m, "id", id);
        m.setProject(project);
        m.setUser(user);
        m.setStatus(status);
        return m;
    }

    private Project otherProject() {
        Project other = new Project();
        ReflectionTestUtils.setField(other, "id", 20L);
        other.setManager(caller);
        return other;
    }

    @Test
    void projectsByUser_nonAdminSeesOnlyActiveRowsInProjectsTheyBelongTo() {
        User target = user(2L, "dev.chen", "ACTIVE");
        Project visible = projectRepository.findById(10L).orElseThrow();
        Project hidden = otherProject();
        when(projectMemberRepository.findByUserId(2L)).thenReturn(List.of(
                row(1L, visible, target, "ACTIVE"),
                row(2L, visible, target, "PENDING"),
                row(3L, hidden, target, "ACTIVE")));
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L));

        var result = service.getProjectsByUserId(2L, "pm.olivia");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(1L);
    }

    @Test
    void projectsByUser_administratorSeesEveryRow() {
        User target = user(2L, "dev.chen", "ACTIVE");
        List<ProjectMember> rows = List.of(
                row(1L, projectRepository.findById(10L).orElseThrow(), target, "ACTIVE"),
                row(3L, otherProject(), target, "PENDING"));
        when(projectAccessGuard.isAdmin(caller)).thenReturn(true);
        when(projectMemberRepository.findByUserId(2L)).thenReturn(rows);

        assertThat(service.getProjectsByUserId(2L, "pm.olivia")).hasSize(2);
    }

    @Test
    void projectsByUser_aStrangerWithNoSharedProjectGetsAnEmptyList() {
        User target = user(2L, "dev.chen", "ACTIVE");
        when(projectMemberRepository.findByUserId(2L)).thenReturn(List.of(row(3L, otherProject(), target, "ACTIVE")));
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of());

        assertThat(service.getProjectsByUserId(2L, "pm.olivia")).isEmpty();
    }

    private ProjectMemberRequest memberRequest(Long projectId, Long userId, String role) {
        ProjectMemberRequest r = new ProjectMemberRequest();
        r.setProjectId(projectId);
        r.setUserId(userId);
        r.setProjectRole(role);
        return r;
    }

    @Test
    void updateMembership_cannotBeRepointedAtAnotherProject() {
        User member = user(2L, "dev.chen", "ACTIVE");
        ProjectMember existing = row(7L, projectRepository.findById(10L).orElseThrow(), member, "ACTIVE");
        existing.setProjectRole("MEMBER");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(20L, 2L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be changed");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void updateMembership_cannotBeHandedToADifferentUser() {
        User member = user(2L, "dev.chen", "ACTIVE");
        ProjectMember existing = row(7L, projectRepository.findById(10L).orElseThrow(), member, "ACTIVE");
        existing.setProjectRole("MEMBER");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 3L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be changed");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void updateMembership_stillAllowsChangingTheRole() {
        User member = user(2L, "dev.chen", "ACTIVE");
        ProjectMember existing = row(7L, projectRepository.findById(10L).orElseThrow(), member, "ACTIVE");
        existing.setProjectRole("MEMBER");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(userRepository.findById(2L)).thenReturn(Optional.of(member));
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateProjectMember(7L, memberRequest(10L, 2L, "VIEWER"), "pm.olivia");

        assertThat(existing.getProjectRole()).isEqualTo("VIEWER");
    }

    // ---- exactly one Owner; ownership moves in one step (ADR-0015, B3.9) -------

    private static User withSystemRole(User u, String roleName) {
        Role role = new Role();
        role.setName(roleName);
        u.setRole(role);
        return u;
    }

    @Test
    void makingAMemberTheOwner_transfersOwnership_inOneStep() {
        Project project = projectRepository.findById(10L).orElseThrow();
        ProjectMember oldRow = row(5L, project, withSystemRole(caller, "PROJECT_MANAGER"), "ACTIVE");
        oldRow.setProjectRole("OWNER");
        User next = withSystemRole(user(2L, "pm.marcus", "ACTIVE"), "PROJECT_MANAGER");
        ProjectMember nextRow = row(7L, project, next, "ACTIVE");
        nextRow.setProjectRole("ADMIN");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(nextRow));
        when(projectMemberRepository.findFirstByProjectIdAndProjectRoleAndStatus(10L, "OWNER", "ACTIVE"))
                .thenReturn(Optional.of(oldRow));
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateProjectMember(7L, memberRequest(10L, 2L, "OWNER"), "pm.olivia");

        assertThat(oldRow.getProjectRole()).as("the previous owner becomes Team Leader").isEqualTo("ADMIN");
        assertThat(nextRow.getProjectRole()).isEqualTo("OWNER");
        assertThat(project.getManager()).as("the project's manager follows the owner").isSameAs(next);
    }

    @Test
    void ownership_cannotGoToSomeoneWhoCannotOwnProjects() {
        Project project = projectRepository.findById(10L).orElseThrow();
        User plainUser = withSystemRole(user(2L, "dev.chen", "ACTIVE"), "USER");
        ProjectMember row = row(7L, project, plainUser, "ACTIVE");
        row.setProjectRole("ADMIN");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(row));

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 2L, "OWNER"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot own a project");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void ownership_needsThePermissionToAssign() {
        Project project = projectRepository.findById(10L).orElseThrow();
        User next = withSystemRole(user(2L, "pm.marcus", "ACTIVE"), "PROJECT_MANAGER");
        ProjectMember row = row(7L, project, next, "ACTIVE");
        row.setProjectRole("ADMIN");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(row));
        lenient().doThrow(new AccessDeniedException("no")).when(projectAccessGuard)
                .assertCan(caller, 10L, Resource.PROJECT, Action.ASSIGN);

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 2L, "OWNER"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void theOwner_cannotBeDemotedOrRemovedDirectly() {
        Project project = projectRepository.findById(10L).orElseThrow();
        User owner = withSystemRole(user(2L, "pm.marcus", "ACTIVE"), "PROJECT_MANAGER");
        ProjectMember ownerRow = row(7L, project, owner, "ACTIVE");
        ownerRow.setProjectRole("OWNER");
        when(projectMemberRepository.findById(7L)).thenReturn(Optional.of(ownerRow));

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 2L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Transfer ownership");
        assertThatThrownBy(() -> service.deleteProjectMember(7L, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Transfer ownership");
        verify(projectMemberRepository, never()).save(any());
        verify(projectMemberRepository, never()).delete(any());
    }

    // ---- who may set whose project role (B3.7, B3.9) ----------------------

    private ProjectMember existingMember(Long rowId, Long userId, String username, String role) {
        User u = user(userId, username, "ACTIVE");
        ProjectMember m = row(rowId, projectRepository.findById(10L).orElseThrow(), u, "ACTIVE");
        m.setProjectRole(role);
        when(projectMemberRepository.findById(rowId)).thenReturn(Optional.of(m));
        lenient().when(userRepository.findById(userId)).thenReturn(Optional.of(u));
        return m;
    }

    @Test
    void nobodyChangesTheirOwnProjectRole() {
        ProjectMember mine = row(5L, projectRepository.findById(10L).orElseThrow(), caller, "ACTIVE");
        mine.setProjectRole("ADMIN");
        when(projectMemberRepository.findById(5L)).thenReturn(Optional.of(mine));

        assertThatThrownBy(() -> service.updateProjectMember(5L, memberRequest(10L, 1L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own project role");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void theOwner_makesAMemberATeamLeader() {
        ProjectMember member = existingMember(7L, 2L, "dev.chen", "MEMBER");
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateProjectMember(7L, memberRequest(10L, 2L, "ADMIN"), "pm.olivia");

        assertThat(member.getProjectRole()).isEqualTo("ADMIN");
    }

    @Test
    void aTeamLeader_makesAMemberAViewer_butNotALeader() {
        when(projectAccessGuard.activeRole(caller, 10L)).thenReturn(Optional.of("ADMIN"));
        ProjectMember member = existingMember(7L, 2L, "dev.chen", "MEMBER");
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateProjectMember(7L, memberRequest(10L, 2L, "VIEWER"), "pm.olivia");
        assertThat(member.getProjectRole()).isEqualTo("VIEWER");

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 2L, "ADMIN"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Team Member or a Viewer");
        assertThat(member.getProjectRole()).isEqualTo("VIEWER");
    }

    @Test
    void aTeamLeader_cannotChangeAnotherLeadersRoleOrTheOwners() {
        when(projectAccessGuard.activeRole(caller, 10L)).thenReturn(Optional.of("ADMIN"));
        ProjectMember leader = existingMember(7L, 2L, "lead.owen", "ADMIN");
        ProjectMember owner = existingMember(8L, 3L, "pm.marcus", "OWNER");

        assertThatThrownBy(() -> service.updateProjectMember(7L, memberRequest(10L, 2L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only the Owner");
        assertThatThrownBy(() -> service.updateProjectMember(8L, memberRequest(10L, 3L, "MEMBER"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(leader.getProjectRole()).isEqualTo("ADMIN");
        assertThat(owner.getProjectRole()).isEqualTo("OWNER");
        verify(projectMemberRepository, never()).save(any());
    }

    @Test
    void anAdministrator_mayChangeAnyRole_butStillNotTheirOwn() {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(true);
        ProjectMember leader = existingMember(7L, 2L, "lead.owen", "ADMIN");
        when(projectMemberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateProjectMember(7L, memberRequest(10L, 2L, "MEMBER"), "pm.olivia");

        assertThat(leader.getProjectRole()).isEqualTo("MEMBER");
    }
}
