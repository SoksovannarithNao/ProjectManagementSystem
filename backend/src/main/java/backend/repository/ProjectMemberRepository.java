package backend.repository;

import backend.entity.ProjectMember;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    // The member LISTS load the project (with its manager and lead), the user (with role,
    // position and department) and the inviter in the same statement, because each row nests a
    // whole ProjectResponse and UserResponse. As lazy loads one by one, a project deleted by
    // someone else while the response was being built failed the whole list with a 500.
    @Override
    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "user", "user.role", "user.position", "user.department", "invitedBy"})
    List<ProjectMember> findAll();

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "user", "user.role", "user.position", "user.department", "invitedBy"})
    List<ProjectMember> findByProjectId(Long projectId);

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "user", "user.role", "user.position", "user.department", "invitedBy"})
    List<ProjectMember> findByProjectIdAndStatus(Long projectId, String status);

    long countByProjectIdAndStatus(Long projectId, String status);

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "user", "user.role", "user.position", "user.department", "invitedBy"})
    List<ProjectMember> findByUserId(Long userId);

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "user", "user.role", "user.position", "user.department", "invitedBy"})
    List<ProjectMember> findByProjectIdIn(Collection<Long> projectIds);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);

    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    // The set of projects a user is an ACTIVE member of — the visibility
    // boundary used to scope tasks/projects/assignments for every role
    // except ADMINISTRATOR (which sees everything). A PENDING (not yet
    // accepted) invitation must not grant visibility — see
    // TaskService/ProjectService/TaskAssigneeService's getAllX() methods.
    @Query("SELECT pm.project.id FROM ProjectMember pm WHERE pm.user.id = :userId AND pm.status = 'ACTIVE'")
    List<Long> findProjectIdsByUserId(@Param("userId") Long userId);

    // Projects where this user is an ACTIVE OWNER/ADMIN — i.e. the projects
    // they administer. Used to authorize the Team-Admin-only actions (e.g.
    // position/department management) that aren't scoped to one specific
    // project up front.
    @Query("""
            SELECT pm.project.id FROM ProjectMember pm
            WHERE pm.user.id = :userId AND pm.status = 'ACTIVE'
              AND pm.projectRole IN ('OWNER', 'ADMIN')
            """)
    List<Long> findActiveAdminProjectIds(@Param("userId") Long userId);

    // How many ACTIVE OWNER rows a project currently has — used by
    // ProjectMemberService to refuse demoting/removing a project's last
    // owner (a project must never end up with zero owners; see
    // ProjectMemberService.assertNotRemovingLastOwner).
    long countByProjectIdAndProjectRoleAndStatus(Long projectId, String projectRole, String status);

    Optional<ProjectMember> findFirstByProjectIdAndProjectRoleAndStatus(Long projectId, String projectRole, String status);

    // Projects where the given user is the ONLY ACTIVE OWNER — used by
    // UserService to refuse deactivating (or deleting) an account that
    // would leave one of these projects ownerless.
    @Query("""
            SELECT pm.project.id FROM ProjectMember pm
            WHERE pm.user.id = :userId AND pm.status = 'ACTIVE' AND pm.projectRole = 'OWNER'
              AND (SELECT COUNT(pm2) FROM ProjectMember pm2
                   WHERE pm2.project.id = pm.project.id AND pm2.status = 'ACTIVE' AND pm2.projectRole = 'OWNER') = 1
            """)
    List<Long> findProjectIdsWhereSoleActiveOwner(@Param("userId") Long userId);

    // Every user who shares at least one ACTIVE project membership with
    // :userId (includes :userId itself, via the project(s) it's active on)
    // — the visibility boundary for the org directory (GET /api/users). A
    // brand-new account with zero project memberships gets nothing back
    // from this query; UserService.getAllUsers adds the caller's own id
    // regardless so they always see themselves.
    @Query("""
            SELECT DISTINCT pm2.user.id FROM ProjectMember pm
            JOIN ProjectMember pm2 ON pm2.project.id = pm.project.id
            WHERE pm.user.id = :userId AND pm.status = 'ACTIVE' AND pm2.status = 'ACTIVE'
            """)
    List<Long> findActiveCoMemberUserIds(@Param("userId") Long userId);
}