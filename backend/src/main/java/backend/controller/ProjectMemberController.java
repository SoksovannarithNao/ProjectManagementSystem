package backend.controller;

import backend.entity.ProjectMember;
import backend.service.ProjectMemberService;
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
    public List<ProjectMember> getAllProjectMembers() {
        return projectMemberService.getAllProjectMembers();
    }

    @GetMapping("/{id}")
    public ProjectMember getProjectMemberById(@PathVariable Long id) {
        return projectMemberService.getProjectMemberById(id);
    }

    @GetMapping("/project/{projectId}")
    public List<ProjectMember> getMembersByProjectId(@PathVariable Long projectId) {
        return projectMemberService.getMembersByProjectId(projectId);
    }

    @GetMapping("/user/{userId}")
    public List<ProjectMember> getProjectsByUserId(@PathVariable Long userId) {
        return projectMemberService.getProjectsByUserId(userId);
    }

    @PostMapping
    public ProjectMember createProjectMember(@RequestBody ProjectMember projectMember) {
        return projectMemberService.createProjectMember(projectMember);
    }

    @PutMapping("/{id}")
    public ProjectMember updateProjectMember(
            @PathVariable Long id,
            @RequestBody ProjectMember projectMember
    ) {
        return projectMemberService.updateProjectMember(id, projectMember);
    }

    @DeleteMapping("/{id}")
    public void deleteProjectMember(@PathVariable Long id) {
        projectMemberService.deleteProjectMember(id);
    }
}