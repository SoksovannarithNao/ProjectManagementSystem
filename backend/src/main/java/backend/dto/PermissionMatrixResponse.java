package backend.dto;

import backend.entity.Role;

import java.util.List;

// Everything the Role & Permission screen needs in one call: the 7 permission
// types, the resources they apply to, and every role with the grants it holds.
public class PermissionMatrixResponse {

    private final List<PermissionInfo> permissions;
    private final List<ResourceInfo> resources;
    private final List<RoleGrants> roles;

    public PermissionMatrixResponse(List<PermissionInfo> permissions, List<ResourceInfo> resources, List<RoleGrants> roles) {
        this.permissions = permissions;
        this.resources = resources;
        this.roles = roles;
    }

    public List<PermissionInfo> getPermissions() {
        return permissions;
    }

    public List<ResourceInfo> getResources() {
        return resources;
    }

    public List<RoleGrants> getRoles() {
        return roles;
    }

    public record PermissionInfo(String code, String description) {
    }

    public record ResourceInfo(String name, String label) {
    }

    public record Grant(String scope, String resource, String permission) {
    }

    public static class RoleGrants {

        private final RoleResponse role;
        private final boolean locked;
        private final List<Grant> grants;

        public RoleGrants(Role role, boolean locked, List<Grant> grants) {
            this.role = new RoleResponse(role);
            this.locked = locked;
            this.grants = grants;
        }

        public RoleResponse getRole() {
            return role;
        }

        // True for ADMINISTRATOR: it always holds everything and cannot be edited.
        public boolean isLocked() {
            return locked;
        }

        public List<Grant> getGrants() {
            return grants;
        }
    }
}
