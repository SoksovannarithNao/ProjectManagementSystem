package backend.controller;

import backend.dto.PermissionMatrixResponse;
import backend.service.RolePermissionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Read side of the Role & Permission screen. Editing a role's grants is
// PUT /api/roles/{id}/permissions (RoleController).
@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    private final RolePermissionService rolePermissionService;

    public PermissionController(RolePermissionService rolePermissionService) {
        this.rolePermissionService = rolePermissionService;
    }

    // The 7 permission types, the resources, and each role's grants.
    @PreAuthorize("@permissions.require(authentication, 'ROLE', 'VIEW')")
    @GetMapping("/matrix")
    public PermissionMatrixResponse getMatrix() {
        return rolePermissionService.getMatrix();
    }
}
