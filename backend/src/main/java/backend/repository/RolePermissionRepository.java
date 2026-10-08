package backend.repository;

import backend.entity.RolePermission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermission.RolePermissionId> {

    List<RolePermission> findByRoleId(Long roleId);

    // Every grant with its role and permission names — what PermissionService
    // loads into memory (the matrix is small: a couple of hundred rows).
    @Query("""
            SELECT r.name AS roleName, rp.scope AS scope, rp.resource AS resource, p.code AS permissionCode
            FROM RolePermission rp, Role r, Permission p
            WHERE rp.roleId = r.id AND rp.permissionId = p.id
            """)
    List<GrantRow> findAllGrants();

    // Used when an administrator saves a role's matrix: the role's rows are
    // replaced as a whole inside one transaction.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM RolePermission rp WHERE rp.roleId = :roleId")
    void deleteAllByRoleId(@Param("roleId") Long roleId);

    interface GrantRow {
        String getRoleName();
        String getScope();
        String getResource();
        String getPermissionCode();
    }
}
