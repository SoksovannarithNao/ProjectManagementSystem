package backend.repository;

import backend.entity.TaskAssignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, Long> {

    List<TaskAssignee> findByTaskId(Long taskId);

    List<TaskAssignee> findByUserId(Long userId);

    boolean existsByTaskIdAndUserId(Long taskId, Long userId);

    // Every assignment on a task belonging to one of the given projects —
    // used to scope GET /api/task-assignees to the caller's visible
    // projects (see TaskAssigneeService.getAllTaskAssignees).
    List<TaskAssignee> findByTask_ProjectIdIn(Collection<Long> projectIds);
}