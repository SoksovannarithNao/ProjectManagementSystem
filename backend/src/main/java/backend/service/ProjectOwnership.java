package backend.service;

import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import org.springframework.stereotype.Component;

// A project has exactly ONE active OWNER, and that person is also the project's
// manager (docs/adr/0015-two-level-roles-system-and-project.md, assignment-brief.md
// B3.9). Everything that creates an owner goes through here: creating a project,
// an administrator reassigning the manager, and a transfer of ownership.
//
// Moving ownership is one step: the previous owner becomes ADMIN (Team Leader)
// and the new owner becomes OWNER in the same transaction. The database check
// (trg_project_members_single_owner) is deferred to commit, so the moment in the
// middle - zero or two owners - is never visible; it stays as the backstop.
@Component
public class ProjectOwnership {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectRepository projectRepository;

    public ProjectOwnership(ProjectMemberRepository projectMemberRepository, ProjectRepository projectRepository) {
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
    }

    // Only a Project Manager or an Administrator can own a project (D-04).
    public static boolean canOwnProjects(User user) {
        if (user == null || user.getRole() == null) {
            return false;
        }
        String role = user.getRole().getName();
        return Role.ADMINISTRATOR.equals(role) || Role.PROJECT_MANAGER.equals(role);
    }

    public static void assertCanOwnProjects(User user) {
        if (!canOwnProjects(user)) {
            throw new IllegalArgumentException(
                    user.getFullName() + " cannot own a project: only a Project Manager or an Administrator can");
        }
    }

    // Makes `owner` the project's single OWNER and manager, adding them as an
    // ACTIVE member first when they are not one yet. Idempotent.
    public ProjectMember assignOwner(Project project, User owner) {
        assertCanOwnProjects(owner);
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(project.getId(), owner.getId())
                .orElseGet(() -> {
                    ProjectMember created = new ProjectMember();
                    created.setProject(project);
                    created.setUser(owner);
                    created.setProjectRole("ADMIN"); // promoted just below
                    created.setStatus("ACTIVE");
                    return created;
                });
        member.setStatus("ACTIVE"); // being made owner is an explicit act: it activates a pending row too
        return transfer(project, member);
    }

    // Moves ownership to an existing membership. The person must be an ACTIVE
    // member and able to own projects.
    public ProjectMember transfer(Project project, ProjectMember newOwner) {
        if (!"ACTIVE".equals(newOwner.getStatus())) {
            throw new IllegalArgumentException("Only an active member can become the project's owner");
        }
        assertCanOwnProjects(newOwner.getUser());

        ProjectMember current = projectMemberRepository
                .findFirstByProjectIdAndProjectRoleAndStatus(project.getId(), "OWNER", "ACTIVE")
                .orElse(null);
        if (current != null && newOwner.getId() != null && current.getId().equals(newOwner.getId())) {
            return current; // already the owner
        }
        if (current != null) {
            current.setProjectRole("ADMIN");
            projectMemberRepository.save(current);
        }
        newOwner.setProjectRole("OWNER");
        newOwner.setStatus("ACTIVE");
        ProjectMember saved = projectMemberRepository.save(newOwner);

        project.setManager(saved.getUser());
        projectRepository.save(project);
        return saved;
    }

    // The current owner's membership, or NotFound for a project without one.
    public ProjectMember currentOwner(Long projectId) {
        return projectMemberRepository.findFirstByProjectIdAndProjectRoleAndStatus(projectId, "OWNER", "ACTIVE")
                .orElseThrow(() -> new NotFoundException("The project has no owner"));
    }
}
