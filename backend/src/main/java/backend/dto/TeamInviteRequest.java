package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class TeamInviteRequest {

    @NotNull
    private Long projectId;

    @NotBlank
    private String username;

    // The role the person will hold in this project once they accept:
    // OWNER (Project Manager), ADMIN (Team Leader), MEMBER (Team Member) or
    // VIEWER. Optional; defaults to MEMBER. Granting OWNER needs PROJECT:ASSIGN.
    @Pattern(regexp = "OWNER|ADMIN|MEMBER|VIEWER", message = "Role must be OWNER, ADMIN, MEMBER or VIEWER")
    private String projectRole;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public void setProjectRole(String projectRole) {
        this.projectRole = projectRole;
    }
}
