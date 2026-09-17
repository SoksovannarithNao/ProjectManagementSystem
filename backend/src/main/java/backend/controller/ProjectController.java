package backend.controller;

import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @GetMapping
    public List<ProjectResponse> getAllProjects(Authentication authentication) {
        return projectService.getAllProjects(authentication.getName());
    }

    @GetMapping("/{id}")
    public ProjectResponse getProjectById(@PathVariable Long id, Authentication authentication) {
        return projectService.getProjectById(id, authentication.getName());
    }

    // Any authenticated user may create a project — they automatically
    // become its OWNER; see ProjectService.createProject.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public ProjectResponse createProject(@Valid @RequestBody ProjectRequest request, Authentication authentication) {
        return projectService.createProject(request, authentication.getName());
    }

    // Requires OWNER/ADMIN of this specific project (or system
    // ADMINISTRATOR) — enforced in ProjectService.updateProject.
    @PutMapping("/{id}")
    public ProjectResponse updateProject(
            @PathVariable Long id,
            @Valid @RequestBody ProjectRequest request,
            Authentication authentication
    ) {
        return projectService.updateProject(id, request, authentication.getName());
    }

    // Requires OWNER of this specific project (or system ADMINISTRATOR) —
    // enforced in ProjectService.deleteProject.
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteProject(@PathVariable Long id, Authentication authentication) {
        projectService.deleteProject(id, authentication.getName());
    }
}
