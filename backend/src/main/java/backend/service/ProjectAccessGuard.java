package backend.service;

import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Shared "does this caller have visibility into this project?" check, used
// by every service whose by-id/by-parent-id read (getTaskById,
// getTasksByProjectId, getProjectById, subtasks, comments, ...) previously
// had NO ownership check at all, unlike their already-scoped getAllX()
// counterparts — see backend/README.md's Security section for the gap this
// closes. ADMINISTRATOR always has access; everyone else must be an ACTIVE
// project_members row for that specific project (a PENDING invitation does
// not count).
@Service
@Transactional(readOnly = true)
public class ProjectAccessGuard {

    private final ProjectMemberRepository projectMemberRepository;

    public ProjectAccessGuard(ProjectMemberRepository projectMemberRepository) {
        this.projectMemberRepository = projectMemberRepository;
    }

    public boolean isAdmin(User user) {
        return "ADMINISTRATOR".equals(user.getRole().getName());
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
}
