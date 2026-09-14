package backend.repository;

import backend.entity.Subtask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubtaskRepository extends JpaRepository<Subtask, Long> {

    List<Subtask> findByTaskIdOrderByIdAsc(Long taskId);

    // Used to refuse marking a task COMPLETED while it still has an
    // incomplete subtask — see TaskService.assertNotCompletingWithOpenSubtasks.
    boolean existsByTaskIdAndStatusNot(Long taskId, String status);
}
