package backend.controller;

import backend.dto.RoleRequest;
import backend.dto.RoleResponse;
import backend.entity.Role;
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

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
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

    @PreAuthorize("hasRole('ADMINISTRATOR')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public RoleResponse createRole(@Valid @RequestBody RoleRequest request) {
        Role role = roleService.createRole(request);
        return new RoleResponse(role);
    }

    @PreAuthorize("hasRole('ADMINISTRATOR')")
    @PutMapping("/{id}")
    public RoleResponse updateRole(@PathVariable Long id, @Valid @RequestBody RoleRequest request) {
        Role role = roleService.updateRole(id, request);
        return new RoleResponse(role);
    }

    @PreAuthorize("hasRole('ADMINISTRATOR')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteRole(@PathVariable Long id) {
        roleService.deleteRole(id);
    }
}
