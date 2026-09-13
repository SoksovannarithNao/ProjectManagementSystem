package backend.repository;

import backend.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    // Used to scope GET /api/projects to the projects the caller is a
    // member of (see ProjectService.getAllProjects).
    List<Project> findByIdIn(Collection<Long> ids);
}