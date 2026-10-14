package backend.repository;

import backend.entity.Task;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // The task LISTS load everything a TaskResponse reads (the project with its manager and lead,
    // the milestone, the creator and the approver) in the same statement as the tasks. Without it
    // each one was a separate lazy load while the response was built, so a project deleted by
    // someone else in between made the whole list fail with a 500 (EntityNotFoundException), and
    // every list cost a query per task and relation.
    @Override
    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "milestone", "createdBy", "approver"})
    List<Task> findAll();

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "milestone", "createdBy", "approver"})
    List<Task> findByProjectId(Long projectId);

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "milestone", "createdBy", "approver"})
    List<Task> findByMilestoneId(Long milestoneId);

    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "milestone", "createdBy", "approver"})
    List<Task> findByStatus(String status);

    // Open tasks (status not in :statuses) due on one of the given dates /
    // before the given date — read by DeadlineNotificationService.
    List<Task> findByDueDateInAndStatusNotIn(Collection<LocalDate> dates, Collection<String> statuses);

    List<Task> findByDueDateBeforeAndStatusNotIn(LocalDate date, Collection<String> statuses);

    // Every task in any of the given projects — used to scope GET
    // /api/tasks to the projects the caller is a member of.
    @EntityGraph(attributePaths = {"project", "project.manager", "project.lead", "milestone", "createdBy", "approver"})
    List<Task> findByProjectIdIn(Collection<Long> projectIds);

    // One grouped query for the task counts of every project (the project cards): cancelled tasks
    // are not counted, overdue = past due and still open (Derived.isTaskOverdue).
    @Query("select t.project.id as projectId, "
            + "sum(case when t.status <> 'CANCELLED' then 1 else 0 end) as total, "
            + "sum(case when t.status = 'COMPLETED' then 1 else 0 end) as completed, "
            + "sum(case when t.status not in ('COMPLETED', 'CANCELLED') and t.dueDate < :today then 1 else 0 end) as overdue "
            + "from Task t group by t.project.id")
    List<ProjectTaskStats> statsByProject(@Param("today") LocalDate today);

    interface ProjectTaskStats {
        Long getProjectId();
        long getTotal();
        long getCompleted();
        long getOverdue();
    }
}