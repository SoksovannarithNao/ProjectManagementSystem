package backend.service;

import backend.dto.UserCreateRequest;
import backend.dto.RegisterRequest;
import backend.dto.UserResponse;
import backend.dto.UserUpdateRequest;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.DepartmentRepository;
import backend.repository.PositionRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// System roles on accounts: the default at registration, giving an account a
// role, and the rule that the system never loses its last Administrator.
@ExtendWith(MockitoExtension.class)
class UserRoleServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PositionRepository positionRepository;
    @Mock
    private DepartmentRepository departmentRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private PermissionService permissionService;

    @Mock
    private AuditLogService auditLogService;

    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(userRepository, roleRepository, positionRepository, departmentRepository,
                projectMemberRepository, new BCryptPasswordEncoder(), projectAccessGuard, permissionService, auditLogService);
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Role role(Long id, String name, String scope) {
        Role r = new Role();
        ReflectionTestUtils.setField(r, "id", id);
        r.setName(name);
        r.setScope(scope);
        lenient().when(roleRepository.findById(id)).thenReturn(Optional.of(r));
        lenient().when(roleRepository.findByName(name)).thenReturn(Optional.of(r));
        return r;
    }

    private User user(Long id, Role role) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername("user" + id);
        u.setFullName("User " + id);
        u.setRole(role);
        lenient().when(userRepository.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    @Test
    void selfRegistration_givesUser_whichCannotCreateProjects() {
        role(4L, "USER", "SYSTEM");
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newcomer");
        request.setEmail("newcomer@example.com");
        request.setPassword("Str0ng!Passw0rd");
        request.setConfirmPassword("Str0ng!Passw0rd");

        User created = service.registerSelfServiceUser(request);

        assertThat(created.getRole().getName()).isEqualTo("USER");
        assertThat(created.getAccountStatus()).isEqualTo("PENDING_VERIFICATION");
    }

    @Test
    void anAdministrator_canGiveAnAccountAnotherSystemRole() {
        Role manager = role(2L, "PROJECT_MANAGER", "SYSTEM");
        User target = user(50L, role(4L, "USER", "SYSTEM"));

        UserResponse response = service.assignRole(50L, 2L);

        assertThat(target.getRole()).isSameAs(manager);
        assertThat(response).isNotNull();
        verify(userRepository).save(target);
    }

    @Test
    void aProjectOnlyRole_cannotBeGivenToAnAccount() {
        role(5L, "VIEWER", "PROJECT");
        user(50L, role(4L, "USER", "SYSTEM"));

        assertThatThrownBy(() -> service.assignRole(50L, 5L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("project-only");
        verify(userRepository, never()).save(any());
    }

    @Test
    void theLastAdministrator_cannotBeDemoted() {
        Role admin = role(1L, "ADMINISTRATOR", "SYSTEM");
        role(4L, "USER", "SYSTEM");
        user(50L, admin);
        when(userRepository.countByRoleName("ADMINISTRATOR")).thenReturn(1L);

        assertThatThrownBy(() -> service.assignRole(50L, 4L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("At least one Administrator");
        verify(userRepository, never()).save(any());
    }

    @Test
    void anAdministrator_canBeDemoted_whenAnotherOneExists() {
        Role admin = role(1L, "ADMINISTRATOR", "SYSTEM");
        Role member = role(4L, "USER", "SYSTEM");
        User target = user(50L, admin);
        when(userRepository.countByRoleName("ADMINISTRATOR")).thenReturn(2L);

        service.assignRole(50L, 4L);

        assertThat(target.getRole()).isSameAs(member);
    }

    @Test
    void assigningAnUnknownRoleOrUser_is404() {
        user(50L, role(4L, "USER", "SYSTEM"));
        when(roleRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignRole(50L, 404L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.assignRole(999L, 4L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void ownPermissions_comeFromThePermissionService() {
        User me = user(7L, role(2L, "PROJECT_MANAGER", "SYSTEM"));
        when(userRepository.findByUsername("user7")).thenReturn(Optional.of(me));

        service.getOwnPermissions("user7");

        ArgumentCaptor<User> asked = ArgumentCaptor.forClass(User.class);
        verify(permissionService).effectiveFor(asked.capture());
        assertThat(asked.getValue()).isSameAs(me);
    }

    @Test
    void aProjectOwner_cannotBeMovedToUser_untilOwnershipIsTransferred() {
        Role manager = role(2L, "PROJECT_MANAGER", "SYSTEM");
        role(4L, "USER", "SYSTEM");
        user(50L, manager);
        when(projectMemberRepository.findProjectIdsWhereSoleActiveOwner(50L)).thenReturn(java.util.List.of(10L, 11L));

        assertThatThrownBy(() -> service.assignRole(50L, 4L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("owns 2 project(s)")
                .hasMessageContaining("Transfer ownership");
        verify(userRepository, never()).save(any());
    }

    @Test
    void aProjectManagerWithoutProjects_canBeMovedToUser() {
        Role manager = role(2L, "PROJECT_MANAGER", "SYSTEM");
        Role plain = role(4L, "USER", "SYSTEM");
        User target = user(50L, manager);
        when(projectMemberRepository.findProjectIdsWhereSoleActiveOwner(50L)).thenReturn(java.util.List.of());

        service.assignRole(50L, 4L);

        assertThat(target.getRole()).isSameAs(plain);
    }

    @Test
    void theLastAdministrator_cannotBeDeactivatedOrDeleted() {
        Role admin = role(1L, "ADMINISTRATOR", "SYSTEM");
        User target = user(50L, admin);
        target.setAccountStatus("ACTIVE");
        when(userRepository.countByRoleName("ADMINISTRATOR")).thenReturn(1L);
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFullName("User 50");
        request.setUsername("user50");
        request.setEmail("user50@example.com");
        request.setAccountStatus("INACTIVE");

        assertThatThrownBy(() -> service.updateUser(50L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("last Administrator cannot be deactivated");
        assertThatThrownBy(() -> service.deleteUser(50L, "someoneelse"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("last Administrator cannot be deleted");
        verify(userRepository, never()).delete(any());
    }

    @Test
    void anAdministrator_canBeDeleted_whenAnotherOneExists() {
        User target = user(50L, role(1L, "ADMINISTRATOR", "SYSTEM"));
        when(userRepository.countByRoleName("ADMINISTRATOR")).thenReturn(2L);

        service.deleteUser(50L, "someoneelse");

        verify(userRepository).delete(target);
    }

    @Test
    void anAccount_cannotDeleteItself() {
        user(50L, role(4L, "USER", "SYSTEM"));

        assertThatThrownBy(() -> service.deleteUser(50L, "User50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("your own account");
        verify(userRepository, never()).delete(any());
    }

    // ---- the audit log (#44) ---------------------------------------------------------

    @Test
    void givingAnAccountAnotherRole_isAudited_withTheRoleBeforeAndAfter() {
        role(2L, "PROJECT_MANAGER", "SYSTEM");
        user(50L, role(4L, "USER", "SYSTEM"));

        service.assignRole(50L, 2L);

        verify(auditLogService).record(AuditLogService.USER_ROLE_CHANGED, AuditLogService.USER, 50L,
                "User 50 (@user50)", null, "USER", "PROJECT_MANAGER");
    }

    @Test
    void aRoleChangeThatFails_isNotAudited() {
        Role admin = role(1L, "ADMINISTRATOR", "SYSTEM");
        role(4L, "USER", "SYSTEM");
        user(50L, admin);
        when(userRepository.countByRoleName("ADMINISTRATOR")).thenReturn(1L);

        assertThatThrownBy(() -> service.assignRole(50L, 4L)).isInstanceOf(IllegalArgumentException.class);

        verify(auditLogService, never()).record(any(String.class), any(), any(), any(), any(), any(), any());
    }

    @Test
    void changingAnAccountsStatus_isAudited_andSoIsDeletingIt() {
        User target = user(50L, role(4L, "USER", "SYSTEM"));
        target.setAccountStatus("ACTIVE");
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFullName("User 50");
        request.setUsername("user50");
        request.setEmail("user50@example.com");
        request.setAccountStatus("SUSPENDED");

        service.updateUser(50L, request);
        verify(auditLogService).record(AuditLogService.ACCOUNT_STATUS_CHANGED, AuditLogService.USER, 50L,
                "User 50 (@user50)", null, "ACTIVE", "SUSPENDED");

        service.deleteUser(50L, "someoneelse");
        verify(auditLogService).record(AuditLogService.ACCOUNT_DELETED, AuditLogService.USER, 50L,
                "User 50 (@user50)", null, "role USER, status SUSPENDED", null);
    }

    @Test
    void savingAnAccountWithoutChangingItsRoleOrStatus_isNotAudited() {
        User target = user(50L, role(4L, "USER", "SYSTEM"));
        target.setAccountStatus("ACTIVE");
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFullName("User 50 renamed");
        request.setUsername("user50");
        request.setEmail("user50@example.com");

        service.updateUser(50L, request);

        verify(auditLogService, never()).record(any(String.class), any(), any(), any(), any(), any(), any());
    }

    @Test
    void anAdministratorCreatingAnAccount_isAudited() {
        Role plain = role(4L, "USER", "SYSTEM");
        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("New Person");
        request.setUsername("new.person");
        request.setEmail("new.person@example.com");
        request.setPassword("Str0ng!Passw0rd");
        request.setAccountStatus("ACTIVE");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 77L);
            return saved;
        });

        service.createUser(request);

        verify(auditLogService).record(AuditLogService.ACCOUNT_CREATED, AuditLogService.USER, 77L,
                "New Person (@new.person)", null, null, "role " + plain.getName() + ", status ACTIVE");
    }
}
