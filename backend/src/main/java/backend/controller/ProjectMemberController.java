package backend.controller;

import backend.dto.ProjectMemberRequest;
import backend.dto.ProjectMemberResponse;
import backend.dto.TeamInviteRequest;
import backend.service.ProjectMemberService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
    public List<ProjectMemberResponse> getAllProjectMembers(Authentication authentication) {
        return projectMemberService.getAllProjectMembers(authentication.getName());
    }

    @GetMapping("/{id}")
    public ProjectMemberResponse getProjectMemberById(@PathVariable Long id, Authentication authentication) {
        return projectMemberService.getProjectMemberById(id, authentication.getName());
    }

    @GetMapping("/project/{projectId}")
    public List<ProjectMemberResponse> getMembersByProjectId(@PathVariable Long projectId, Authentication authentication) {
        return projectMemberService.getMembersByProjectId(projectId, authentication.getName());
    }

    @GetMapping("/user/{userId}")
    public List<ProjectMemberResponse> getProjectsByUserId(@PathVariable Long userId) {
        return projectMemberService.getProjectsByUserId(userId);
    }

    // Team-Admin-only (enforced in the service, scoped to the specific
    // project) — pending invitations sent for a project.
    @GetMapping("/project/{projectId}/invitations")
    public List<ProjectMemberResponse> getPendingInvitations(@PathVariable Long projectId, Authentication authentication) {
        return projectMemberService.getPendingInvitations(projectId, authentication.getName());
    }

    // Coarse role gate matching the rest of this controller's write
    // endpoints; ProjectMemberService.inviteMember additionally enforces
    // that the caller actually administers THIS project (see assertTeamAdmin).
    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/invite")
    public ProjectMemberResponse inviteMember(@Valid @RequestBody TeamInviteRequest request, Authentication authentication) {
        return projectMemberService.inviteMember(request, authentication.getName());
    }

    // Any authenticated user may accept/decline their own invitation — no
    // role gate, scoped to "the caller's own pending invitation" in the
    // service (same pattern as the self-scoped notification endpoints).
    @PostMapping("/project/{projectId}/accept")
    public ProjectMemberResponse acceptInvitation(@PathVariable Long projectId, Authentication authentication) {
        return projectMemberService.respondToInvitation(projectId, authentication.getName(), true);
    }

    @PostMapping("/project/{projectId}/decline")
    public ProjectMemberResponse declineInvitation(@PathVariable Long projectId, Authentication authentication) {
        return projectMemberService.respondToInvitation(projectId, authentication.getName(), false);
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
