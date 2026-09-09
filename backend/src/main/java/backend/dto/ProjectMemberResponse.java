package backend.dto;

import backend.entity.ProjectMember;

import java.time.OffsetDateTime;

public class ProjectMemberResponse {

    private Long id;
    private ProjectResponse project;
    private UserResponse user;
    private String projectRole;
    private OffsetDateTime joinedAt;

    public ProjectMemberResponse(ProjectMember projectMember) {
        this.id = projectMember.getId();
        this.project = new ProjectResponse(projectMember.getProject());
        this.user = new UserResponse(projectMember.getUser());
        this.projectRole = projectMember.getProjectRole();
        this.joinedAt = projectMember.getJoinedAt();
    }

    public Long getId() {
        return id;
    }

    public ProjectResponse getProject() {
        return project;
    }

    public UserResponse getUser() {
        return user;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public OffsetDateTime getJoinedAt() {
        return joinedAt;
    }
}
