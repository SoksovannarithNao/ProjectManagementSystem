package backend.service;

import backend.dto.RoleRequest;
import backend.entity.Role;
import backend.exception.ConflictException;
import backend.exception.NotFoundException;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Extra system roles (D-14): created, renamed and deleted by an administrator; the
// built-in roles keep their names and cannot be deleted.
@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock
    private RoleRepository roleRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PermissionService permissionService;

    @Mock
    private AuditLogService auditLogService;

    private RoleService service;

    @BeforeEach
    void setUp() {
        service = new RoleService(roleRepository, userRepository, permissionService, auditLogService);
        lenient().when(roleRepository.save(any(Role.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private RoleRequest request(String name, String description) {
        RoleRequest r = new RoleRequest();
        r.setName(name);
        r.setDescription(description);
        return r;
    }

    private Role role(Long id, String name, boolean builtIn) {
        Role r = new Role();
        ReflectionTestUtils.setField(r, "id", id);
        r.setName(name);
        r.setBuiltIn(builtIn);
        lenient().when(roleRepository.findById(id)).thenReturn(Optional.of(r));
        lenient().when(roleRepository.findByName(name)).thenReturn(Optional.of(r));
        return r;
    }

    @Test
    void aNewRole_isASystemRoleStoredInUpperCase_withNoProjectRole_andReloadsEnforcement() {
        Role created = service.createRole(request("  Quality auditor ", "Reads reports"));

        assertThat(created.getName()).isEqualTo("QUALITY_AUDITOR");
        assertThat(created.getScope()).isEqualTo("SYSTEM");
        assertThat(created.getProjectRole()).isNull();
        assertThat(created.isBuiltIn()).isFalse();
        assertThat(created.getDescription()).isEqualTo("Reads reports");
        verify(permissionService).refresh();
    }

    @Test
    void aBlankDescription_isStoredAsNothing() {
        assertThat(service.createRole(request("Auditor", "   ")).getDescription()).isNull();
    }

    @Test
    void aRoleNameThatIsTakenIsRefused_whateverTheLetterCase() {
        role(1L, "ADMINISTRATOR", true);

        assertThatThrownBy(() -> service.createRole(request("administrator", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Administrator already exists");
        verify(roleRepository, never()).save(any());
    }

    @Test
    void aRoleNameWithOddCharactersOrNoLetters_isRefused() {
        for (String bad : new String[] {"", "A", "9lives", "Boss!", "a/b"}) {
            assertThatThrownBy(() -> service.createRole(request(bad, null)))
                    .as(bad)
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("A role name needs");
        }
    }

    @Test
    void anExtraRole_canBeRenamed_butNotToANameInUse() {
        Role auditor = role(10L, "AUDITOR", false);
        role(11L, "REVIEWER", false);

        service.updateRole(10L, request("Senior Auditor", "More"));
        assertThat(auditor.getName()).isEqualTo("SENIOR_AUDITOR");

        assertThatThrownBy(() -> service.updateRole(10L, request("reviewer", null)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void savingAnExtraRoleUnderItsOwnName_isNotAConflict() {
        Role auditor = role(10L, "AUDITOR", false);

        service.updateRole(10L, request("Auditor", "New text"));

        assertThat(auditor.getDescription()).isEqualTo("New text");
    }

    @Test
    void aBuiltInRole_keepsItsName_butItsDescriptionCanChange() {
        Role member = role(4L, "MEMBER", true);

        assertThatThrownBy(() -> service.updateRole(4L, request("Worker", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be renamed");

        service.updateRole(4L, request("MEMBER", "Works on tasks"));
        assertThat(member.getDescription()).isEqualTo("Works on tasks");
    }

    @Test
    void aBuiltInRole_cannotBeDeleted() {
        role(2L, "PROJECT_MANAGER", true);

        assertThatThrownBy(() -> service.deleteRole(2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot be deleted");
        verify(roleRepository, never()).delete(any());
    }

    @Test
    void aRoleThatAccountsHold_cannotBeDeleted() {
        role(10L, "AUDITOR", false);
        when(userRepository.countByRoleName("AUDITOR")).thenReturn(3L);

        assertThatThrownBy(() -> service.deleteRole(10L))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("given to 3 account(s)");
        verify(roleRepository, never()).delete(any());
    }

    @Test
    void anUnusedExtraRole_isDeleted_andEnforcementReloads() {
        Role auditor = role(10L, "AUDITOR", false);
        when(userRepository.countByRoleName("AUDITOR")).thenReturn(0L);

        service.deleteRole(10L);

        verify(roleRepository).delete(auditor);
        verify(permissionService).refresh();
    }

    @Test
    void anUnknownRole_is404() {
        when(roleRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteRole(404L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.updateRole(404L, request("X1", null))).isInstanceOf(NotFoundException.class);
    }

    // ---- the audit log (#44) ---------------------------------------------------------

    @Test
    void creatingRenamingAndDeletingAnExtraRole_areAudited() {
        Role created = service.createRole(request("Quality auditor", "Reads reports"));
        verify(auditLogService).record(AuditLogService.ROLE_CREATED, AuditLogService.ROLE, null, "QUALITY_AUDITOR", null,
                null, "QUALITY_AUDITOR - Reads reports");

        role(10L, "AUDITOR", false);
        when(userRepository.countByRoleName("SENIOR_AUDITOR")).thenReturn(0L);
        service.updateRole(10L, request("Senior auditor", null));
        verify(auditLogService).record(AuditLogService.ROLE_UPDATED, AuditLogService.ROLE, 10L, "SENIOR_AUDITOR", null,
                "AUDITOR", "SENIOR_AUDITOR");

        service.deleteRole(10L);
        verify(auditLogService).record(AuditLogService.ROLE_DELETED, AuditLogService.ROLE, 10L, "SENIOR_AUDITOR", null,
                "SENIOR_AUDITOR", null);
        assertThat(created.getName()).isEqualTo("QUALITY_AUDITOR");
    }

    @Test
    void savingARoleWithoutChangingIt_isNotAudited() {
        role(10L, "AUDITOR", false);

        service.updateRole(10L, request("Auditor", null));

        verify(auditLogService, never()).record(any(String.class), any(), any(), any(), any(), any(), any());
    }
}
