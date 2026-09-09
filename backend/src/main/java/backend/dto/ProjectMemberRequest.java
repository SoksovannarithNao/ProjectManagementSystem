package backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class ProjectMemberRequest {

    @NotNull
    private Long projectId;

    @NotNull
    private Long userId;

    @Pattern(regexp = "PROJECT_MANAGER|TEAM_LEADER|TEAM_MEMBER")
    private String projectRole;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public void setProjectRole(String projectRole) {
        this.projectRole = projectRole;
    }
}
