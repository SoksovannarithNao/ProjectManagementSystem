package backend.repository;

import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskDependencyRepository
        extends JpaRepository<TaskDependency, TaskDependencyId> {

    List<TaskDependency> findByTaskId(Long taskId);

    List<TaskDependency> findByDependsOnTaskId(Long taskId);
}