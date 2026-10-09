package backend.repository;

import backend.entity.ChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {

    List<ChecklistItem> findByTaskIdOrderBySortOrderAscIdAsc(Long taskId);

    @Query("select coalesce(max(c.sortOrder), 0) from ChecklistItem c where c.task.id = :taskId")
    int maxSortOrder(@Param("taskId") Long taskId);

    // One grouped query for a whole task list (the "2/5 checklist" next to the
    // subtask count), same idea as SubtaskRepository.countByTaskIds.
    @Query("select c.task.id as taskId, count(c) as total, "
            + "sum(case when c.completed = true then 1 else 0 end) as completed "
            + "from ChecklistItem c where c.task.id in :taskIds group by c.task.id")
    List<ChecklistCounts> countByTaskIds(@Param("taskIds") Collection<Long> taskIds);

    interface ChecklistCounts {
        Long getTaskId();

        long getTotal();

        long getCompleted();
    }
}
