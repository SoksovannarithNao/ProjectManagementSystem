package backend.repository;

import backend.entity.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    List<ProjectMember> findByProjectId(Long projectId);

    List<ProjectMember> findByProjectIdAndStatus(Long projectId, String status);

    List<ProjectMember> findByUserId(Long userId);

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
}