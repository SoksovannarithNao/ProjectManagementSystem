package backend.service;

import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

// The single entry point for "may this caller do this?" in every service.
// Two questions, kept apart on purpose:
//
//  1. VISIBILITY  — is the caller a member of the project at all?
//     (hasAccess / assertAccess). A PENDING invitation does not count. A
//     non-member gets 404, not 403, so a project's existence is not revealed.
//
//  2. PERMISSION  — may the caller do ACTION on RESOURCE?
//     (can / assertCan inside a project, systemCan / assertSystemCan for
//     things that are not about one project). The answer comes from the
//     role_permissions table through PermissionService, not from role names
//     written into the code. A missing permission is a 403 with a message.
//
// ADMINISTRATOR (a system role unrelated to any one project) passes both
// questions everywhere. Project authority comes from the caller's own ACTIVE
// project_members row and its project role (OWNER, ADMIN, MEMBER, VIEWER);
// see docs/adr/0015-two-level-roles-system-and-project.md.
@Service
@Transactional(readOnly = true)
public class ProjectAccessGuard {

    private final ProjectMemberRepository projectMemberRepository;
    private final PermissionService permissionService;

    public ProjectAccessGuard(ProjectMemberRepository projectMemberRepository, PermissionService permissionService) {
        this.projectMemberRepository = projectMemberRepository;
        this.permissionService = permissionService;
    }

    // Null-safe: users.role_id is optional.
    public boolean isAdmin(User user) {
        return permissionService.isAdministrator(user);
    }

    // ---------------- visibility ----------------

    public boolean hasAccess(User user, Long projectId) {
        return isAdmin(user) || projectMemberRepository.findProjectIdsByUserId(user.getId()).contains(projectId);
    }

    // 404 rather than 403 — same "don't confirm a resource's existence to a
    // caller who can't see it" reasoning already used by
    // NotificationService.markAsRead/deleteNotification.
    public void assertAccess(User user, Long projectId) {
        if (!hasAccess(user, projectId)) {
            throw new NotFoundException("Project not found");
        }
    }

    // The caller's own ACTIVE project_role for this project (OWNER, ADMIN,
    // MEMBER or VIEWER) — empty if they're not an active member (regardless
    // of ADMINISTRATOR status; callers that need the bypass check isAdmin).
    public Optional<String> activeRole(User user, Long projectId) {
        return projectMemberRepository.findByProjectIdAndUserId(projectId, user.getId())
                .filter(pm -> "ACTIVE".equals(pm.getStatus()))
                .map(ProjectMember::getProjectRole);
    }

    // ---------------- permission inside a project ----------------

    public boolean can(User user, Long projectId, Resource resource, Action action) {
        return permissionService.projectCan(user, projectId, resource, action);
    }

    public void assertCan(User user, Long projectId, Resource resource, Action action) {
        if (!can(user, projectId, resource, action)) {
            throw new AccessDeniedException(denialMessage(resource, action, true));
        }
    }

    // ---------------- permission that is not about one project ----------------

    public boolean systemCan(User user, Resource resource, Action action) {
        return permissionService.systemCan(user, resource, action);
    }

    public void assertSystemCan(User user, Resource resource, Action action) {
        if (!systemCan(user, resource, action)) {
            throw new AccessDeniedException(denialMessage(resource, action, false));
        }
    }

    // Clear, specific 403 text. A few actions get a sentence that says who CAN
    // do it; everything else is "You do not have permission to <verb> <thing>".
    static String denialMessage(Resource resource, Action action, boolean inProject) {
        if (resource == Resource.PROJECT && action == Action.CREATE) {
            return "Only a Project Manager or an Administrator can create a project";
        }
        if (resource == Resource.TASK && action == Action.APPROVE) {
            return "Only a Project Manager or Team Leader can approve a task as completed. "
                    + "Move it to In Review so it can be approved";
        }
        if (resource == Resource.REPORT && action == Action.GENERATE_REPORTS) {
            return "You do not have permission to generate reports";
        }
        if (resource == Resource.MEMBER && inProject) {
            switch (action) {
                case CREATE:
                    return "You do not have permission to invite or add people to this project";
                case EDIT:
                    return "You do not have permission to change a member's role in this project";
                case DELETE:
                    return "You do not have permission to remove members from this project";
                default:
                    break;
            }
        }
        return "You do not have permission to " + action.verb() + " " + resource.label()
                + (inProject ? " in this project" : "");
    }
}
