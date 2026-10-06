package backend.service;

import backend.dto.InvitableUserResponse;
import backend.dto.PendingInvitationCountResponse;
import backend.dto.ProjectMemberRequest;
import backend.dto.TeamInviteRequest;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
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
        service = new ProjectMemberService(
                projectMemberRepository, projectRepository, userRepository, projectAccessGuard, notificationService);
        caller = user(1L, "pm.olivia", "ACTIVE");
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setManager(caller);
        // lenient: pure helper tests (likePattern) don't touch these.
        lenient().when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
        lenient().when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
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
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCanManage(caller, 10L);

        assertThatThrownBy(() -> service.inviteMember(invite("dev.chen"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(userRepository, never()).findByUsernameIgnoreCase(anyString());
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
        verify(projectAccessGuard).assertCanManage(caller, 10L);
        verify(projectMemberRepository, never()).findByProjectIdAndStatus(any(), eq("ACTIVE"));
    }

    @Test
    void pendingCount_isTeamAdminOnly() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCanManage(caller, 10L);

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
        verify(projectAccessGuard).assertCanManage(caller, 10L);
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
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCanManage(caller, 10L);

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
}
