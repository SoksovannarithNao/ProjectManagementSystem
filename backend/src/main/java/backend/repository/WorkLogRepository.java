package backend.repository;

import backend.entity.WorkLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface WorkLogRepository extends JpaRepository<WorkLog, Long> {

    List<WorkLog> findByTaskIdOrderByWorkDateDescIdDesc(Long taskId);

    // One grouped query for a whole task list's logged hours (TaskResponse.actualHours),
    // instead of a per-task sum — same approach as SubtaskRepository.countByTaskIds.
    @Query("select w.task.id as taskId, sum(w.hoursWorked) as hours "
            + "from WorkLog w where w.task.id in :taskIds group by w.task.id")
    List<TaskHours> sumHoursByTaskIds(@Param("taskIds") List<Long> taskIds);

    @Query("select coalesce(sum(w.hoursWorked), 0) from WorkLog w where w.task.id = :taskId")
    BigDecimal sumHoursByTaskId(@Param("taskId") Long taskId);

    interface TaskHours {
        Long getTaskId();
        BigDecimal getHours();
    }
}
