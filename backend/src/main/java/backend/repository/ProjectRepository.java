package backend.repository;

import backend.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    // Used to scope GET /api/projects to the projects the caller is a
    // member of (see ProjectService.getAllProjects).
    List<Project> findByIdIn(Collection<Long> ids);

    // Unfinished projects ending on one of the given dates — read by DeadlineNotificationService.
    List<Project> findByEndDateInAndStatusNotIn(Collection<LocalDate> dates, Collection<String> statuses);

    // Feeds ProjectService.generateProjectCode — every auto-style code in use.
    @Query("select p.projectCode from Project p where p.projectCode like 'PRJ-%'")
    List<String> findAutoProjectCodes();

    // Held until the surrounding transaction ends, so two simultaneous creates take
    // turns picking the next PRJ-#### instead of choosing the same one. The cast is
    // only there because Hibernate cannot map the function's void result.
    @Query(value = "select cast(pg_advisory_xact_lock(4001) as text)", nativeQuery = true)
    String lockProjectCodeGeneration();

    boolean existsByProjectCode(String projectCode);

    boolean existsByProjectCodeAndIdNot(String projectCode, Long id);
}