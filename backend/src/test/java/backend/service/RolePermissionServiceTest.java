package backend.service;

import backend.dto.RoleGrantsRequest;
import backend.entity.Permission;
import backend.entity.Role;
import backend.entity.RolePermission;
import backend.exception.NotFoundException;
import backend.repository.PermissionRepository;
import backend.repository.RolePermissionRepository;
import backend.repository.RoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RolePermissionServiceTest {

    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PermissionRepository permissionRepository;
    @Mock
    private RolePermissionRepository rolePermissionRepository;
    @Mock
    private PermissionService permissionService;

    private RolePermissionService service;

    @BeforeEach
    void setUp() {
        service = new RolePermissionService(roleRepository, permissionRepository, rolePermissionRepository, permissionService);

        List<Permission> catalog = new ArrayList<>();
        long id = 1;
        for (String code : List.of("VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "APPROVE", "GENERATE_REPORTS")) {
            Permission p = new Permission();
            ReflectionTestUtils.setField(p, "id", id++);
            ReflectionTestUtils.setField(p, "code", code);
            catalog.add(p);
        }
        lenient().when(permissionRepository.findAll()).thenReturn(catalog);
    }

    private Role role(Long id, String name, String scope, String projectRole) {
        Role r = new Role();
        ReflectionTestUtils.setField(r, "id", id);
        r.setName(name);
        r.setScope(scope);
        r.setProjectRole(projectRole);
        lenient().when(roleRepository.findById(id)).thenReturn(Optional.of(r));
        return r;
    }

    private RoleGrantsRequest grants(String... triples) {
        RoleGrantsRequest request = new RoleGrantsRequest();
        List<RoleGrantsRequest.GrantItem> items = new ArrayList<>();
        for (String t : triples) {
            String[] parts = t.split(":");
            RoleGrantsRequest.GrantItem item = new RoleGrantsRequest.GrantItem();
            item.setScope(parts[0]);
            item.setResource(parts[1]);
            item.setPermission(parts[2]);
            items.add(item);
        }
        request.setGrants(items);
        return request;
    }

    @Test
    void administratorRole_isLockedAndCannotBeEdited() {
        role(1L, "ADMINISTRATOR", "SYSTEM", null);

        assertThatThrownBy(() -> service.replaceGrants(1L, grants("SYSTEM:TASK:VIEW")))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("cannot be edited");
        verify(rolePermissionRepository, never()).deleteAllByRoleId(any());
    }

    @Test
    void unknownRole_is404() {
        assertThatThrownBy(() -> service.replaceGrants(99L, grants("SYSTEM:REPORT:GENERATE_REPORTS")))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void savingReplacesTheRolesGrants_andReloadsEnforcement() {
        role(3L, "ADMIN", "PROJECT", "ADMIN");

        var result = service.replaceGrants(3L, grants(
                "PROJECT:PROJECT:VIEW", "PROJECT:TASK:APPROVE", "PROJECT:REPORT:GENERATE_REPORTS"));

        verify(rolePermissionRepository).deleteAllByRoleId(3L);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<RolePermission>> saved = ArgumentCaptor.forClass(Iterable.class);
        verify(rolePermissionRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(3);
        verify(permissionService).refresh();
        assertThat(result.getGrants()).hasSize(3);
    }

    @Test
    void duplicateGrants_areStoredOnce() {
        role(3L, "ADMIN", "PROJECT", "ADMIN");

        var result = service.replaceGrants(3L, grants(
                "PROJECT:PROJECT:VIEW", "PROJECT:PROJECT:VIEW", "PROJECT:TASK:VIEW"));

        assertThat(result.getGrants()).hasSize(2);
    }

    @Test
    void aProjectRole_cannotLoseViewOnTheProject_orItsMembersWouldBeStranded() {
        role(4L, "MEMBER", "PROJECT", "MEMBER");

        assertThatThrownBy(() -> service.replaceGrants(4L, grants("PROJECT:TASK:VIEW")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("view projects");
        verify(rolePermissionRepository, never()).deleteAllByRoleId(any());
    }

    @Test
    void aProjectOnlyRole_cannotHoldSystemPermissions() {
        role(5L, "VIEWER", "PROJECT", "VIEWER");

        assertThatThrownBy(() -> service.replaceGrants(5L, grants("PROJECT:PROJECT:VIEW", "SYSTEM:REPORT:GENERATE_REPORTS")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("project-only");
    }

    @Test
    void aSystemOnlyRole_cannotHoldProjectPermissions() {
        role(6L, "AUDITOR", "SYSTEM", null);

        assertThatThrownBy(() -> service.replaceGrants(6L, grants("PROJECT:TASK:VIEW")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("system-only");
    }

    @Test
    void unknownScopeResourceOrPermission_isRejected() {
        role(3L, "ADMIN", "PROJECT", "ADMIN");

        assertThatThrownBy(() -> service.replaceGrants(3L, grants("GLOBAL:TASK:VIEW")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("scope");
        assertThatThrownBy(() -> service.replaceGrants(3L, grants("PROJECT:BANANA:VIEW")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("resource");
        assertThatThrownBy(() -> service.replaceGrants(3L, grants("PROJECT:TASK:FLY")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("permission");
    }
}
