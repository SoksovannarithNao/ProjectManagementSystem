package backend.controller;

import backend.dto.ProjectMemberRequest;
import backend.dto.ProjectMemberResponse;
import backend.dto.TeamInviteRequest;
import backend.service.ProjectMemberService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    // Requires OWNER/ADMIN of this specific project (or system
    // ADMINISTRATOR) — enforced in ProjectMemberService.inviteMember.
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

    // Requires OWNER/ADMIN of the target project — enforced in
    // ProjectMemberService.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public ProjectMemberResponse createProjectMember(@Valid @RequestBody ProjectMemberRequest request, Authentication authentication) {
        return projectMemberService.createProjectMember(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public ProjectMemberResponse updateProjectMember(
            @PathVariable Long id,
            @Valid @RequestBody ProjectMemberRequest request,
            Authentication authentication
    ) {
        return projectMemberService.updateProjectMember(id, request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteProjectMember(@PathVariable Long id, Authentication authentication) {
        projectMemberService.deleteProjectMember(id, authentication.getName());
    }
}
