package backend.controller;

import backend.dto.ProjectLeadRequest;
import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.service.ProjectService;
import backend.util.PageParams;
import backend.util.ProjectListQuery;
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

    // Every parameter is optional (B1.9, B7.2); filters combine with AND, several values of
    // status or priority with OR. They only narrow what the caller may already see.
    // With ?page and/or ?size the answer is a page ({ items, total, page, size }) instead of the
    // whole list; without them it is the whole list, as before.
    @GetMapping
    public Object getAllProjects(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> priority,
            @RequestParam(required = false) Long managerId,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            Authentication authentication
    ) {
        ProjectListQuery query = new ProjectListQuery(search, status, priority, managerId, sort);
        PageParams paging = PageParams.of(page, size);
        return paging == null
                ? projectService.getAllProjects(authentication.getName(), query)
                : projectService.getProjectsPage(authentication.getName(), query, paging);
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

    // Names a Team Leader of the project as its lead, or clears the lead. Needs
    // PROJECT:ASSIGN in this project (the Owner, or an Administrator) - enforced in
    // ProjectService.setLead.
    @PutMapping("/{id}/lead")
    public ProjectResponse setLead(
            @PathVariable Long id,
            @RequestBody ProjectLeadRequest request,
            Authentication authentication
    ) {
        return projectService.setLead(id, request.getUserId(), authentication.getName());
    }

    // Requires OWNER of this specific project (or system ADMINISTRATOR) —
    // enforced in ProjectService.deleteProject.
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteProject(@PathVariable Long id, Authentication authentication) {
        projectService.deleteProject(id, authentication.getName());
    }
}
