package backend.controller;

import backend.dto.ProjectMemberRequest;
import backend.dto.ProjectMemberResponse;
import backend.service.ProjectMemberService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-members")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;

    public ProjectMemberController(ProjectMemberService projectMemberService) {
        this.projectMemberService = projectMemberService;
    }

    @GetMapping
    public List<ProjectMemberResponse> getAllProjectMembers() {
        return projectMemberService.getAllProjectMembers();
    }

    @GetMapping("/{id}")
    public ProjectMemberResponse getProjectMemberById(@PathVariable Long id) {
        return projectMemberService.getProjectMemberById(id);
    }

    @GetMapping("/project/{projectId}")
    public List<ProjectMemberResponse> getMembersByProjectId(@PathVariable Long projectId) {
        return projectMemberService.getMembersByProjectId(projectId);
    }

    @GetMapping("/user/{userId}")
    public List<ProjectMemberResponse> getProjectsByUserId(@PathVariable Long userId) {
        return projectMemberService.getProjectsByUserId(userId);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public ProjectMemberResponse createProjectMember(@Valid @RequestBody ProjectMemberRequest request) {
        return projectMemberService.createProjectMember(request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @PutMapping("/{id}")
    public ProjectMemberResponse updateProjectMember(
            @PathVariable Long id,
            @Valid @RequestBody ProjectMemberRequest request
    ) {
        return projectMemberService.updateProjectMember(id, request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteProjectMember(@PathVariable Long id) {
        projectMemberService.deleteProjectMember(id);
    }
}
