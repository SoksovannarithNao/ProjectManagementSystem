package backend.dto;

import backend.entity.ProjectMember;

import java.time.OffsetDateTime;

public class ProjectMemberResponse {

    private Long id;
    private ProjectResponse project;
    private UserResponse user;
    private String projectRole;
    private String status;
    private Long invitedById;
    private String invitedByName;
    private OffsetDateTime respondedAt;
    private OffsetDateTime joinedAt;

    public ProjectMemberResponse(ProjectMember projectMember) {
        this.id = projectMember.getId();
        this.project = new ProjectResponse(projectMember.getProject());
        this.user = new UserResponse(projectMember.getUser());
        this.projectRole = projectMember.getProjectRole();
        this.status = projectMember.getStatus();
        this.invitedById = projectMember.getInvitedBy() != null ? projectMember.getInvitedBy().getId() : null;
        this.invitedByName = projectMember.getInvitedBy() != null ? projectMember.getInvitedBy().getFullName() : null;
        this.respondedAt = projectMember.getRespondedAt();
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

    public String getStatus() {
        return status;
    }

    public Long getInvitedById() {
        return invitedById;
    }

    public String getInvitedByName() {
        return invitedByName;
    }

    public OffsetDateTime getRespondedAt() {
        return respondedAt;
    }
}
