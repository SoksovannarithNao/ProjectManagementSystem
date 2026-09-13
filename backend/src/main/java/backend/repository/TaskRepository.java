package backend.repository;

import backend.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectId(Long projectId);

    List<Task> findByMilestoneId(Long milestoneId);

    List<Task> findByStatus(String status);

    // Every task in any of the given projects — used to scope GET
    // /api/tasks to the projects the caller is a member of.
    List<Task> findByProjectIdIn(Collection<Long> projectIds);
}