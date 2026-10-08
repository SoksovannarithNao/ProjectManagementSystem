package backend.dto;

import java.util.List;
import java.util.Set;

// What the signed-in user may do: system-wide grants, plus the grants they hold
// inside each project where they are an ACTIVE member. Grants are
// "RESOURCE:ACTION" strings, e.g. "TASK:CREATE". The frontend uses this to hide
// controls the user cannot use; the backend still checks every request itself.
public class EffectivePermissionsResponse {

    private final String role;
    private final boolean administrator;
    private final List<String> system;
    private final List<ProjectGrant> projects;

    public EffectivePermissionsResponse(String role, boolean administrator, Set<String> system, List<ProjectGrant> projects) {
        this.role = role;
        this.administrator = administrator;
        this.system = List.copyOf(system);
        this.projects = projects;
    }

    public String getRole() {
        return role;
    }

    public boolean isAdministrator() {
        return administrator;
    }

    public List<String> getSystem() {
        return system;
    }

    public List<ProjectGrant> getProjects() {
        return projects;
    }

    public static class ProjectGrant {

        private final Long projectId;
        private final String projectRole;
        private final String roleName;
        private final List<String> grants;

        public ProjectGrant(Long projectId, String projectRole, String roleName, Set<String> grants) {
            this.projectId = projectId;
            this.projectRole = projectRole;
            this.roleName = roleName;
            this.grants = List.copyOf(grants);
        }

        public Long getProjectId() {
            return projectId;
        }

        public String getProjectRole() {
            return projectRole;
        }

        public String getRoleName() {
            return roleName;
        }

        public List<String> getGrants() {
            return grants;
        }
    }
}
