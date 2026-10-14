package backend.repository;

import backend.entity.TaskAssignee;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, Long> {

    // Each row nests a whole TaskResponse and UserResponse, so the lists load the task, its
    // project (with manager and lead), milestone, creator and approver, and the user (with role,
    // position and department) in the same statement. Without it each was a lazy load while the
    // response was built, and a task or project deleted by someone else in between made the whole
    // list fail with a 500 (EntityNotFoundException).
    @Override
    @EntityGraph(attributePaths = {"task", "task.project", "task.project.manager", "task.project.lead", "task.milestone", "task.createdBy", "task.approver", "user", "user.role", "user.position", "user.department"})
    List<TaskAssignee> findAll();

    @EntityGraph(attributePaths = {"task", "task.project", "task.project.manager", "task.project.lead", "task.milestone", "task.createdBy", "task.approver", "user", "user.role", "user.position", "user.department"})
    List<TaskAssignee> findByTaskId(Long taskId);

    @EntityGraph(attributePaths = {"task", "task.project", "task.project.manager", "task.project.lead", "task.milestone", "task.createdBy", "task.approver", "user", "user.role", "user.position", "user.department"})
    List<TaskAssignee> findByTaskIdIn(Collection<Long> taskIds);

    @EntityGraph(attributePaths = {"task", "task.project", "task.project.manager", "task.project.lead", "task.milestone", "task.createdBy", "task.approver", "user", "user.role", "user.position", "user.department"})
    List<TaskAssignee> findByUserId(Long userId);

    boolean existsByTaskIdAndUserId(Long taskId, Long userId);

    // Every assignment on a task belonging to one of the given projects —
    // used to scope GET /api/task-assignees to the caller's visible
    // projects (see TaskAssigneeService.getAllTaskAssignees).
    @EntityGraph(attributePaths = {"task", "task.project", "task.project.manager", "task.project.lead", "task.milestone", "task.createdBy", "task.approver", "user", "user.role", "user.position", "user.department"})
    List<TaskAssignee> findByTask_ProjectIdIn(Collection<Long> projectIds);
}