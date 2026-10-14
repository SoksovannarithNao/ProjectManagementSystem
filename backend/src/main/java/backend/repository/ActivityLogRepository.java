package backend.repository;

import backend.entity.ActivityLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    // The project-wide feed: everything recorded against the project, tasks
    // included (a deleted task's entry keeps its project).
    List<ActivityLog> findByProjectIdOrderByCreatedAtDescIdDesc(Long projectId, Pageable pageable);

    // The dashboard's "recent activities": across several projects.
    List<ActivityLog> findByProjectIdInOrderByCreatedAtDescIdDesc(Collection<Long> projectIds, Pageable pageable);

    List<ActivityLog> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
