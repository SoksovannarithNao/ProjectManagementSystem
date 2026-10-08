package backend.dto;

import jakarta.validation.constraints.NotNull;

// Body of PUT /api/users/{id}/role: the system role an administrator gives an account.
public class RoleAssignmentRequest {

    @NotNull
    private Long roleId;

    public Long getRoleId() {
        return roleId;
    }

    public void setRoleId(Long roleId) {
        this.roleId = roleId;
    }
}
