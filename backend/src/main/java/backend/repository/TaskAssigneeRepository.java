package backend.repository;

import backend.entity.TaskAssignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskAssigneeRepository extends JpaRepository<TaskAssignee, Long> {

    List<TaskAssignee> findByTaskId(Long taskId);

    List<TaskAssignee> findByUserId(Long userId);
}