package backend.controller;

import backend.dto.RoleRequest;
import backend.dto.RoleResponse;
import backend.entity.Role;
import backend.dto.PermissionMatrixResponse;
import backend.dto.RoleGrantsRequest;
import backend.service.RolePermissionService;
import backend.service.RoleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleService roleService;

    private final RolePermissionService rolePermissionService;

    public RoleController(RoleService roleService, RolePermissionService rolePermissionService) {
        this.roleService = roleService;
        this.rolePermissionService = rolePermissionService;
    }

    @GetMapping
    public List<RoleResponse> getAllRoles() {
        return roleService.getAllRoles()
                .stream()
                .map(RoleResponse::new)
                .toList();
    }

    @GetMapping("/{id}")
    public RoleResponse getRoleById(@PathVariable Long id) {
        return new RoleResponse(roleService.getRoleById(id));
    }

    @PreAuthorize("@permissions.require(authentication, 'ROLE', 'CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public RoleResponse createRole(@Valid @RequestBody RoleRequest request) {
        Role role = roleService.createRole(request);
        return new RoleResponse(role);
    }

    @PreAuthorize("@permissions.require(authentication, 'ROLE', 'EDIT')")
    @PutMapping("/{id}")
    public RoleResponse updateRole(@PathVariable Long id, @Valid @RequestBody RoleRequest request) {
        Role role = roleService.updateRole(id, request);
        return new RoleResponse(role);
    }

    @PreAuthorize("@permissions.require(authentication, 'ROLE', 'DELETE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteRole(@PathVariable Long id) {
        roleService.deleteRole(id);
    }

    // Replaces the role's whole set of grants (role x resource x action).
    // Takes effect immediately: PermissionService reloads after the save.
    @PreAuthorize("@permissions.require(authentication, 'ROLE', 'EDIT')")
    @PutMapping("/{id}/permissions")
    public PermissionMatrixResponse.RoleGrants updateRolePermissions(
            @PathVariable Long id,
            @Valid @RequestBody RoleGrantsRequest request) {
        return rolePermissionService.replaceGrants(id, request);
    }
}
