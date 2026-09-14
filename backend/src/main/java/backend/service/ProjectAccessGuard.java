package backend.service;

import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.Set;

// Shared "does this caller have visibility into / authority over this
// project?" check, used by every service that reads or writes a
// project-scoped resource (projects, tasks, milestones, dependencies,
// assignees, project_members). ADMINISTRATOR (a SYSTEM-level role, unrelated
// to any one project — see User.role) always has full access; the USER
// system role (assigned to every self-registered account) grants nothing
// here — it's not checked anywhere in this class. Everyone who isn't
// ADMINISTRATOR has their authority come entirely from their ACTIVE
// project_members row (a PENDING invitation does not count) and its
// project_role:
//   OWNER  — full authority, including delete/transfer-ownership
//   ADMIN  — manages content and members, but not delete/transfer-ownership
//   MEMBER — can create/edit content, cannot manage members
//   VIEWER — read-only
@Service
@Transactional(readOnly = true)
public class ProjectAccessGuard {

    private static final Set<String> MANAGE_ROLES = Set.of("OWNER", "ADMIN");
    private static final Set<String> CONTENT_ROLES = Set.of("OWNER", "ADMIN", "MEMBER");

    private final ProjectMemberRepository projectMemberRepository;

    public ProjectAccessGuard(ProjectMemberRepository projectMemberRepository) {
        this.projectMemberRepository = projectMemberRepository;
    }

    // Null-safe: users.role_id is optional (system-role only) — a normal
    // user has no Role at all, not just a non-ADMINISTRATOR one.
    public boolean isAdmin(User user) {
        return user.getRole() != null && "ADMINISTRATOR".equals(user.getRole().getName());
    }

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

    // The caller's own ACTIVE project_role for this project — empty if
    // they're not an active member (regardless of ADMINISTRATOR status;
    // callers that need the ADMINISTRATOR bypass check isAdmin separately).
    public Optional<String> activeRole(User user, Long projectId) {
        return projectMemberRepository.findByProjectIdAndUserId(projectId, user.getId())
                .filter(pm -> "ACTIVE".equals(pm.getStatus()))
                .map(ProjectMember::getProjectRole);
    }

    // OWNER or ADMIN of this project — manages content, members, milestones,
    // dependencies, assignees. Not authority to delete/transfer ownership;
    // see isOwner.
    public boolean canManage(User user, Long projectId) {
        return isAdmin(user) || activeRole(user, projectId).filter(MANAGE_ROLES::contains).isPresent();
    }

    // OWNER only — deleting or transferring ownership of the project, or
    // promoting another member to OWNER.
    public boolean isOwner(User user, Long projectId) {
        return isAdmin(user) || activeRole(user, projectId).filter("OWNER"::equals).isPresent();
    }

    // OWNER/ADMIN/MEMBER — creating/editing tasks and other project content.
    // Excludes VIEWER (read-only).
    public boolean canEditContent(User user, Long projectId) {
        return isAdmin(user) || activeRole(user, projectId).filter(CONTENT_ROLES::contains).isPresent();
    }

    public void assertCanManage(User user, Long projectId) {
        if (!canManage(user, projectId)) {
            throw new AccessDeniedException("You do not have permission to manage this project");
        }
    }

    public void assertIsOwner(User user, Long projectId) {
        if (!isOwner(user, projectId)) {
            throw new AccessDeniedException("Only the project owner can do this");
        }
    }

    public void assertCanEditContent(User user, Long projectId) {
        if (!canEditContent(user, projectId)) {
            throw new AccessDeniedException("You do not have permission to edit this project's content");
        }
    }
}
