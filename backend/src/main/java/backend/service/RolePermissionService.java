package backend.service;

import backend.dto.PermissionMatrixResponse;
import backend.dto.PermissionMatrixResponse.Grant;
import backend.dto.PermissionMatrixResponse.RoleGrants;
import backend.dto.RoleGrantsRequest;
import backend.entity.Permission;
import backend.entity.Role;
import backend.entity.RolePermission;
import backend.exception.NotFoundException;
import backend.repository.PermissionRepository;
import backend.repository.RolePermissionRepository;
import backend.repository.RoleRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Reads and edits the role x resource x action matrix (role_permissions) for
// the Role & Permission screen. PermissionService is what enforcement reads;
// every successful edit here tells it to reload.
@Service
@Transactional
public class RolePermissionService {

    // Display order of the built-in roles; anything else sorts after them.
    private static final List<String> ROLE_ORDER = List.of(
            Role.ADMINISTRATOR, Role.PROJECT_MANAGER, Role.USER, Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER);

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionService permissionService;

    public RolePermissionService(
            RoleRepository roleRepository,
            PermissionRepository permissionRepository,
            RolePermissionRepository rolePermissionRepository,
            PermissionService permissionService) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.permissionService = permissionService;
    }

    @Transactional(readOnly = true)
    public PermissionMatrixResponse getMatrix() {
        List<PermissionMatrixResponse.PermissionInfo> permissions = permissionRepository.findAll().stream()
                .sorted(Comparator.comparing(Permission::getId))
                .map(p -> new PermissionMatrixResponse.PermissionInfo(p.getCode(), p.getDescription()))
                .toList();
        List<PermissionMatrixResponse.ResourceInfo> resources = Arrays.stream(Resource.values())
                .map(r -> new PermissionMatrixResponse.ResourceInfo(r.name(), r.label()))
                .toList();

        Map<String, List<Grant>> grantsByRole = new HashMap<>();
        for (var row : rolePermissionRepository.findAllGrants()) {
            grantsByRole.computeIfAbsent(row.getRoleName(), k -> new ArrayList<>())
                    .add(new Grant(row.getScope(), row.getResource(), row.getPermissionCode()));
        }

        List<RoleGrants> roles = roleRepository.findAll().stream()
                .sorted(Comparator.comparingInt((Role r) -> orderOf(r.getName())).thenComparing(Role::getName))
                .map(r -> new RoleGrants(r, Role.ADMINISTRATOR.equals(r.getName()),
                        grantsByRole.getOrDefault(r.getName(), List.of())))
                .toList();
        return new PermissionMatrixResponse(permissions, resources, roles);
    }

    private static int orderOf(String roleName) {
        int i = ROLE_ORDER.indexOf(roleName);
        return i < 0 ? ROLE_ORDER.size() : i;
    }

    // Replaces ALL of the role's grants with the submitted list.
    public RoleGrants replaceGrants(Long roleId, RoleGrantsRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new NotFoundException("Role not found"));
        if (Role.ADMINISTRATOR.equals(role.getName())) {
            throw new AccessDeniedException(
                    "The Administrator role always holds every permission and cannot be edited");
        }

        Map<String, Permission> permissionsByCode = new HashMap<>();
        for (Permission p : permissionRepository.findAll()) {
            permissionsByCode.put(p.getCode(), p);
        }

        Set<RolePermission> wanted = new LinkedHashSet<>();
        Set<String> seen = new LinkedHashSet<>();
        boolean keepsProjectView = false;
        for (RoleGrantsRequest.GrantItem item : request.getGrants()) {
            String scope = item.getScope();
            if (!RolePermission.SCOPE_SYSTEM.equals(scope) && !RolePermission.SCOPE_PROJECT.equals(scope)) {
                throw new IllegalArgumentException("Unknown scope '" + scope + "' (use SYSTEM or PROJECT)");
            }
            Resource resource = Resource.parse(item.getResource())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown resource '" + item.getResource() + "'"));
            Action action = Action.parse(item.getPermission())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown permission '" + item.getPermission() + "'"));
            assertScopeAllowed(role, scope);

            if (!seen.add(scope + "|" + resource + "|" + action)) {
                continue;
            }
            Permission permission = permissionsByCode.get(action.name());
            if (permission == null) {
                throw new IllegalArgumentException("Permission " + action + " is not in the catalog");
            }
            wanted.add(new RolePermission(role.getId(), permission.getId(), resource.name(), scope));
            if (RolePermission.SCOPE_PROJECT.equals(scope) && resource == Resource.PROJECT && action == Action.VIEW) {
                keepsProjectView = true;
            }
        }

        // Lock-out guard: a project role that cannot view its own project would
        // strand every member who holds it.
        if (role.getProjectRole() != null && !keepsProjectView) {
            throw new IllegalArgumentException(
                    "A project role must keep 'view projects' so its members can still open their project");
        }

        rolePermissionRepository.deleteAllByRoleId(role.getId());
        rolePermissionRepository.saveAll(wanted);
        permissionService.refresh();

        List<Grant> grants = wanted.stream()
                .map(rp -> new Grant(rp.getScope(), rp.getResource(), codeOf(permissionsByCode, rp.getPermissionId())))
                .toList();
        return new RoleGrants(role, false, grants);
    }

    private static void assertScopeAllowed(Role role, String scope) {
        boolean system = RolePermission.SCOPE_SYSTEM.equals(scope);
        boolean allowed = "BOTH".equals(role.getScope()) || role.getScope().equals(scope);
        if (!allowed) {
            throw new IllegalArgumentException(role.getName() + " is a "
                    + (system ? "project-only" : "system-only") + " role and cannot hold "
                    + (system ? "system" : "project") + " permissions");
        }
    }

    private static String codeOf(Map<String, Permission> byCode, Long permissionId) {
        return byCode.values().stream()
                .filter(p -> p.getId().equals(permissionId))
                .map(Permission::getCode)
                .findFirst()
                .orElse("?");
    }
}
