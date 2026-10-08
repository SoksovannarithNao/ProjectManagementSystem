package backend.service;

import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectAccessGuardTest {

    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private PermissionService permissionService;

    private ProjectAccessGuard guard;
    private User user;

    @BeforeEach
    void setUp() {
        guard = new ProjectAccessGuard(projectMemberRepository, permissionService);
        user = new User();
        ReflectionTestUtils.setField(user, "id", 1L);
    }

    // ---- visibility: membership only, 404 for strangers ------------------

    @Test
    void aMemberCanSeeTheirProject_aStrangerGetsA404() {
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L));

        assertThatCode(() -> guard.assertAccess(user, 10L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> guard.assertAccess(user, 20L))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Project not found");
    }

    @Test
    void anAdministratorSeesEveryProject() {
        lenient().when(permissionService.isAdministrator(user)).thenReturn(true);

        assertThat(guard.hasAccess(user, 12345L)).isTrue();
    }

    @Test
    void activeRoleIgnoresPendingInvitations() {
        ProjectMember pending = new ProjectMember();
        pending.setProjectRole("ADMIN");
        pending.setStatus("PENDING");
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 1L)).thenReturn(Optional.of(pending));

        assertThat(guard.activeRole(user, 10L)).isEmpty();
    }

    // ---- permission: delegated to the matrix, 403 with a clear message ---

    @Test
    void assertCan_passesWhenThePermissionIsHeld() {
        when(permissionService.projectCan(user, 10L, Resource.TASK, Action.CREATE)).thenReturn(true);

        assertThatCode(() -> guard.assertCan(user, 10L, Resource.TASK, Action.CREATE)).doesNotThrowAnyException();
    }

    @Test
    void assertCan_refusesWithASpecificMessage() {
        when(permissionService.projectCan(user, 10L, Resource.MILESTONE, Action.CREATE)).thenReturn(false);

        assertThatThrownBy(() -> guard.assertCan(user, 10L, Resource.MILESTONE, Action.CREATE))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("You do not have permission to create milestones in this project");
    }

    @Test
    void assertSystemCan_refusesCreatingAProjectWithAMessageSayingWhoCan() {
        when(permissionService.systemCan(user, Resource.PROJECT, Action.CREATE)).thenReturn(false);

        assertThatThrownBy(() -> guard.assertSystemCan(user, Resource.PROJECT, Action.CREATE))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("Only a Project Manager or an Administrator can create a project");
    }

    @Test
    void approvalMessage_tellsTheCallerWhatToDoInstead() {
        assertThat(ProjectAccessGuard.denialMessage(Resource.TASK, Action.APPROVE, true))
                .contains("Project Manager or Team Leader")
                .contains("In Review");
    }

    @Test
    void genericMessage_namesTheActionAndTheThing() {
        assertThat(ProjectAccessGuard.denialMessage(Resource.WORK_LOG, Action.DELETE, true))
                .isEqualTo("You do not have permission to delete time entries in this project");
        assertThat(ProjectAccessGuard.denialMessage(Resource.USER, Action.CREATE, false))
                .isEqualTo("You do not have permission to create users");
    }

    @Test
    void isAdmin_delegatesToTheRoleCheck() {
        Role admin = new Role();
        admin.setName(Role.ADMINISTRATOR);
        user.setRole(admin);
        when(permissionService.isAdministrator(user)).thenReturn(true);

        assertThat(guard.isAdmin(user)).isTrue();
    }
}
