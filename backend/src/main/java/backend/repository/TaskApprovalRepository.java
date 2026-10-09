package backend.repository;

import backend.entity.TaskApproval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskApprovalRepository extends JpaRepository<TaskApproval, Long> {

    // Newest first: the panel's approval history.
    List<TaskApproval> findByTaskIdOrderByRequestedAtDescIdDesc(Long taskId);

    Optional<TaskApproval> findFirstByTaskIdAndDecision(Long taskId, String decision);

    // One batched query for a whole task list - TaskService picks the newest
    // row per task to show "awaiting approval" without an N+1 fetch.
    List<TaskApproval> findByTaskIdInOrderByRequestedAtDescIdDesc(Collection<Long> taskIds);

    List<TaskApproval> findByDecisionOrderByRequestedAtAsc(String decision);
}
