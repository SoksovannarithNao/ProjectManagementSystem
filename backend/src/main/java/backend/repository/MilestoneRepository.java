package backend.repository;

import backend.entity.Milestone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {

    List<Milestone> findByProjectId(Long projectId);

    // Unfinished milestones due on one of the given dates — read by DeadlineNotificationService.
    List<Milestone> findByDueDateInAndStatusNot(Collection<LocalDate> dates, String status);
}