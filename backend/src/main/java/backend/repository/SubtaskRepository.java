package backend.repository;

import backend.entity.Subtask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubtaskRepository extends JpaRepository<Subtask, Long> {

    List<Subtask> findByTaskIdOrderByIdAsc(Long taskId);

    // Used to refuse marking a task COMPLETED while it still has an
    // incomplete subtask — see TaskService.assertNotCompletingWithOpenSubtasks.
    boolean existsByTaskIdAndStatusNot(Long taskId, String status);

    // One grouped query for a whole task list's subtask counts (task list ->
    // "N/M subtasks" progress in TaskResponse) instead of a per-task fetch —
    // see TaskService.subtaskCountsByTaskId.
    @Query("select s.task.id as taskId, count(s) as total, "
            + "sum(case when s.status = 'COMPLETED' then 1 else 0 end) as completed "
            + "from Subtask s where s.task.id in :taskIds group by s.task.id")
    List<SubtaskCounts> countByTaskIds(@Param("taskIds") List<Long> taskIds);

    interface SubtaskCounts {
        Long getTaskId();
        long getTotal();
        long getCompleted();
    }
}
