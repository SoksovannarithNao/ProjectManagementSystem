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

    // For every task in a candidate list that's "Blocked", one row per
    // not-yet-COMPLETED dependency naming what it's blocked by — both
    // whether a task is blocked and *what* it's waiting on come from this
    // single grouped query, same batching pattern as
    // SubtaskRepository.countByTaskIds, instead of a per-task existence check.
    @Query("select td.task.id as taskId, td.dependsOnTask.title as title from TaskDependency td "
            + "where td.task.id in :taskIds and td.dependsOnTask.status <> 'COMPLETED'")
    List<BlockingTaskRow> findBlockingTasks(@Param("taskIds") List<Long> taskIds);

    interface BlockingTaskRow {
        Long getTaskId();
        String getTitle();
    }
}