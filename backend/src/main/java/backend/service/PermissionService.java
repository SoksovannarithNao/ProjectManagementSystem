package backend.service;

import backend.dto.EffectivePermissionsResponse;
import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.RolePermissionRepository;
import backend.repository.RoleRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

// The one place that answers "may this user do ACTION on RESOURCE?" from the
// role_permissions table (Role_Requirment.md: "each role should have different
// permissions"). It replaces the rules that used to be hard-coded in
// ProjectAccessGuard and mirrored in frontend/src/api/permissions.js.
//
// A grant is (role, scope, resource, action):
//   * SYSTEM  scope: applies anywhere, from the role on users.role_id;
//   * PROJECT scope: applies inside a project where the user is an ACTIVE
//     member, from the project role of that membership (roles.project_role:
//     OWNER, ADMIN, MEMBER, VIEWER - the business names are Project Manager,
//     Team Leader, Team Member and Viewer).
// System roles (ADMINISTRATOR, PROJECT_MANAGER, USER) never widen a project
// role: inside a project the project role decides (ADR-0015).
// ADMINISTRATOR is allowed everything and is not looked up.
//
// The matrix is small (a couple of hundred rows) and read on almost every
// request, so it is held in memory and reloaded whenever an administrator
// edits it (refresh()). Single backend instance: no cross-node invalidation.
@Service
@Transactional(readOnly = true)
public class PermissionService {

    private final RolePermissionRepository rolePermissionRepository;
    private final RoleRepository roleRepository;
    private final ProjectMemberRepository projectMemberRepository;

    private volatile Snapshot snapshot;

    public PermissionService(
            RolePermissionRepository rolePermissionRepository,
            RoleRepository roleRepository,
            ProjectMemberRepository projectMemberRepository) {
        this.rolePermissionRepository = rolePermissionRepository;
        this.roleRepository = roleRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    private record Snapshot(Map<String, Set<String>> grants, Map<String, String> roleNameByProjectRole) {
    }

    private static String grantKey(String roleName, String scope) {
        return roleName + "|" + scope;
    }

    private static String permissionKey(Resource resource, Action action) {
        return resource.name() + ":" + action.name();
    }

    private Snapshot snapshot() {
        Snapshot current = snapshot;
        if (current == null) {
            Map<String, Set<String>> grants = new HashMap<>();
            for (var row : rolePermissionRepository.findAllGrants()) {
                grants.computeIfAbsent(grantKey(row.getRoleName(), row.getScope()), k -> new HashSet<>())
                        .add(row.getResource() + ":" + row.getPermissionCode());
            }
            Map<String, String> byProjectRole = new HashMap<>();
            for (Role role : roleRepository.findAll()) {
                if (role.getProjectRole() != null) {
                    byProjectRole.put(role.getProjectRole(), role.getName());
                }
            }
            current = new Snapshot(grants, byProjectRole);
            snapshot = current;
        }
        return current;
    }

    // Called after any change to role_permissions or roles.
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.SUPPORTS)
    public void refresh() {
        snapshot = null;
    }

    public boolean isAdministrator(User user) {
        return user.getRole() != null && Role.ADMINISTRATOR.equals(user.getRole().getName());
    }

    // The role name a project_members.project_role stands for, e.g. OWNER -> PROJECT_MANAGER.
    public Optional<String> roleNameForProjectRole(String projectRole) {
        return Optional.ofNullable(snapshot().roleNameByProjectRole().get(projectRole));
    }

    private Set<String> grantsOf(String roleName, String scope) {
        if (roleName == null) {
            return Set.of();
        }
        return snapshot().grants().getOrDefault(grantKey(roleName, scope), Set.of());
    }

    // Permission that is not about one project: create a project, generate
    // reports, manage users and roles. Held through the user's system role.
    public boolean systemCan(User user, Resource resource, Action action) {
        if (isAdministrator(user)) {
            return true;
        }
        String roleName = user.getRole() != null ? user.getRole().getName() : null;
        return grantsOf(roleName, "SYSTEM").contains(permissionKey(resource, action));
    }

    // Permission inside one project. Requires an ACTIVE membership (a PENDING
    // invitation grants nothing); the grant comes from the role that the
    // member's project_role maps to, or from the user's system role.
    public boolean projectCan(User user, Long projectId, Resource resource, Action action) {
        if (isAdministrator(user)) {
            return true;
        }
        if (systemCan(user, resource, action)) {
            return true;
        }
        Optional<String> projectRole = activeProjectRole(user, projectId);
        if (projectRole.isEmpty()) {
            return false;
        }
        String roleName = snapshot().roleNameByProjectRole().get(projectRole.get());
        return grantsOf(roleName, "PROJECT").contains(permissionKey(resource, action));
    }

    public Optional<String> activeProjectRole(User user, Long projectId) {
        return projectMemberRepository.findByProjectIdAndUserId(projectId, user.getId())
                .filter(pm -> "ACTIVE".equals(pm.getStatus()))
                .map(ProjectMember::getProjectRole);
    }

    // Everything the signed-in user may do, for the frontend to hide what is
    // not allowed. The frontend never decides on its own; it only mirrors this.
    public EffectivePermissionsResponse effectiveFor(User user) {
        boolean admin = isAdministrator(user);
        String roleName = user.getRole() != null ? user.getRole().getName() : null;

        Set<String> system = admin ? allPermissions() : new TreeSet<>(grantsOf(roleName, "SYSTEM"));

        List<EffectivePermissionsResponse.ProjectGrant> projects = new ArrayList<>();
        if (!admin) {
            for (ProjectMember pm : projectMemberRepository.findByUserId(user.getId())) {
                if (!"ACTIVE".equals(pm.getStatus())) {
                    continue;
                }
                String projectRoleName = snapshot().roleNameByProjectRole().get(pm.getProjectRole());
                Set<String> grants = new TreeSet<>(grantsOf(projectRoleName, "PROJECT"));
                projects.add(new EffectivePermissionsResponse.ProjectGrant(
                        pm.getProject().getId(), pm.getProjectRole(), projectRoleName, grants));
            }
        }
        return new EffectivePermissionsResponse(roleName, admin, system, projects);
    }

    private static Set<String> allPermissions() {
        Set<String> all = new TreeSet<>();
        for (Resource resource : Resource.values()) {
            for (Action action : Action.values()) {
                all.add(permissionKey(resource, action));
            }
        }
        return all;
    }
}
