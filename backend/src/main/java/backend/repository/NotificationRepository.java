package backend.repository;

import backend.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    // One page of a person's notifications, newest first (the Pageable carries the order).
    Page<Notification> findByUserId(Long userId, Pageable pageable);

    List<Notification> findByUserIdAndReadFalse(Long userId);

    long countByUserIdAndReadFalse(Long userId);

    // Idempotency checks for the scheduled deadline / overdue notifications:
    // the same text for the same person and item is never created twice.
    boolean existsByUserIdAndTypeAndTaskIdAndMessage(Long userId, String type, Long taskId, String message);

    boolean existsByUserIdAndTypeAndProjectIdAndTaskIsNullAndMessage(Long userId, String type, Long projectId, String message);
}
