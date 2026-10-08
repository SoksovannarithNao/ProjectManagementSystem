package backend.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;

// "This role may do this action on this resource", at system scope (anywhere)
// or project scope (inside a project where the user holds the role's
// project_role). Plain columns instead of associations: PermissionService
// only ever needs the ids, and it keeps the composite key simple.
@Entity
@Table(name = "role_permissions")
@IdClass(RolePermission.RolePermissionId.class)
public class RolePermission {

    public static final String SCOPE_SYSTEM = "SYSTEM";
    public static final String SCOPE_PROJECT = "PROJECT";

    @Id
    @Column(name = "role_id", nullable = false)
    private Long roleId;

    @Id
    @Column(name = "permission_id", nullable = false)
    private Long permissionId;

    @Id
    @Column(nullable = false, length = 30)
    private String resource;

    @Id
    @Column(nullable = false, length = 10)
    private String scope;

    protected RolePermission() {
    }

    public RolePermission(Long roleId, Long permissionId, String resource, String scope) {
        this.roleId = roleId;
        this.permissionId = permissionId;
        this.resource = resource;
        this.scope = scope;
    }

    public Long getRoleId() {
        return roleId;
    }

    public Long getPermissionId() {
        return permissionId;
    }

    public String getResource() {
        return resource;
    }

    public String getScope() {
        return scope;
    }

    public static class RolePermissionId implements Serializable {

        private Long roleId;
        private Long permissionId;
        private String resource;
        private String scope;

        public RolePermissionId() {
        }

        public RolePermissionId(Long roleId, Long permissionId, String resource, String scope) {
            this.roleId = roleId;
            this.permissionId = permissionId;
            this.resource = resource;
            this.scope = scope;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof RolePermissionId that)) {
                return false;
            }
            return Objects.equals(roleId, that.roleId)
                    && Objects.equals(permissionId, that.permissionId)
                    && Objects.equals(resource, that.resource)
                    && Objects.equals(scope, that.scope);
        }

        @Override
        public int hashCode() {
            return Objects.hash(roleId, permissionId, resource, scope);
        }
    }
}
