package backend.repository;

import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TaskDependencyRepository
        extends JpaRepository<TaskDependency, TaskDependencyId> {

    List<TaskDependency> findByTaskId(Long taskId);

    List<TaskDependency> findByDependsOnTaskId(Long taskId);

    // Used by SubtaskService's TO_DO -> IN_PROGRESS auto-promotion to check
    // first whether that move is even allowed — trg_tasks_dependencies_status_gate
    // (01-init.sql) would otherwise reject it, taking the whole subtask
    // update down with it in the same transaction.
    boolean existsByTaskIdAndDependsOnTaskStatusNot(Long taskId, String status);

    // Distinct task ids (within a candidate list) that are "Blocked" — they
    // depend on at least one task that isn't COMPLETED yet. One grouped query
    // for a whole task list, same batching pattern as
    // SubtaskRepository.countByTaskIds, instead of a per-task existence check.
    @Query("select distinct td.task.id from TaskDependency td "
            + "where td.task.id in :taskIds and td.dependsOnTask.status <> 'COMPLETED'")
    List<Long> findBlockedTaskIds(@Param("taskIds") List<Long> taskIds);
}