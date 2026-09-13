package backend.repository;

import backend.entity.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    List<ProjectMember> findByProjectId(Long projectId);

    List<ProjectMember> findByUserId(Long userId);

    List<ProjectMember> findByProjectIdIn(Collection<Long> projectIds);

    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    // The set of projects a user is a member of — the visibility boundary
    // used to scope tasks/projects/assignments for every role except
    // ADMINISTRATOR (which sees everything). See TaskService/ProjectService/
    // TaskAssigneeService's getAllX() methods.
    @Query("SELECT pm.project.id FROM ProjectMember pm WHERE pm.user.id = :userId")
    List<Long> findProjectIdsByUserId(@Param("userId") Long userId);
}