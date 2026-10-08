package backend.service;

import backend.dto.InvitableUserResponse;
import backend.dto.PendingInvitationCountResponse;
import backend.dto.ProjectMemberRequest;
import backend.dto.ProjectMemberResponse;
import backend.dto.TeamInviteRequest;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final NotificationService notificationService;
    private final ProjectOwnership projectOwnership;

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            NotificationService notificationService,
            ProjectOwnership projectOwnership) {
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.notificationService = notificationService;
        this.projectOwnership = projectOwnership;
    }

    private static final String ONE_OWNER_MESSAGE =
            "A project has exactly one owner. Add the person as a Team Leader or Team Member, then transfer ownership to them";

    // Nobody is invited or added AS the owner: ownership is transferred to an
    // existing member (updateProjectMember).
    private static void assertNotOwnerRole(String projectRole) {
        if ("OWNER".equals(projectRole)) {
            throw new IllegalArgumentException(ONE_OWNER_MESSAGE);
        }
    }

    // Scoped the same way as TaskService.getAllTasks — otherwise this
    // endpoint would leak the membership/existence of projects a caller
    // can't see via GET /api/projects. ACTIVE only — the frontend's Team
    // page uses this list to count "who's actually on which project," and a
    // PENDING (not yet accepted) invitation isn't a real membership yet; see
    // getPendingInvitations for those.
    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getAllProjectMembers(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<ProjectMember> members;
        if (projectAccessGuard.isAdmin(caller)) {
            members = projectMemberRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            members = projectMemberRepository.findByProjectIdIn(visibleProjectIds);
        }

        return members.stream()
                .filter(m -> "ACTIVE".equals(m.getStatus()))
                .map(ProjectMemberResponse::new)
                .toList();
    }

    // Previously had no ownership check at all, unlike getAllProjectMembers
    // just above — any authenticated user could look up any project_members
    // row by id. Now requires the caller to actually have access to that
    // row's project (ADMINISTRATOR, or an ACTIVE member of it).
    @Transactional(readOnly = true)
    public ProjectMemberResponse getProjectMemberById(Long id, String username) {
        ProjectMember member = getProjectMemberEntityById(id);
        projectAccessGuard.assertAccess(requireUser(username), member.getProject().getId());
        return new ProjectMemberResponse(member);
    }

    @Transactional(readOnly = true)
    public ProjectMember getProjectMemberEntityById(Long id) {
        return projectMemberRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Project member not found"));
    }

    // Same ownership gap as getProjectMemberById above. Only returns ACTIVE
    // members — a PENDING invitation isn't a real team member yet. Team
    // Admins see pending invitations separately via getPendingInvitations.
    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getMembersByProjectId(Long projectId, String username) {
        projectAccessGuard.assertAccess(requireUser(username), projectId);
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "ACTIVE")
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    // "Which projects is this user on" — limited to what the caller may see:
    // a system administrator gets every row; anyone else gets only the ACTIVE
    // memberships in projects the caller is themself an active member of, so
    // the lookup can't reveal projects (or pending invitations) outside the
    // caller's own visibility.
    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getProjectsByUserId(Long userId, String username) {
        User caller = requireUser(username);
        List<ProjectMember> rows = projectMemberRepository.findByUserId(userId);
        if (!projectAccessGuard.isAdmin(caller)) {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            rows = rows.stream()
                    .filter(m -> "ACTIVE".equals(m.getStatus()))
                    .filter(m -> visibleProjectIds.contains(m.getProject().getId()))
                    .toList();
        }
        return rows.stream().map(ProjectMemberResponse::new).toList();
    }

    // Team-Admin-only: invitations sent for a project, awaiting a response.
    public List<ProjectMemberResponse> getPendingInvitations(Long projectId, String username) {
        Project project = requireProject(projectId);
        projectAccessGuard.assertCan(requireUser(username), project.getId(), Resource.MEMBER, Action.CREATE);
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "PENDING")
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    // Same Team-Admin gate as the invitation list above — just the size of it
    // (PENDING rows for this project), for the "N pending invitations" line
    // on the project page, without shipping every invitee's details.
    @Transactional(readOnly = true)
    public PendingInvitationCountResponse countPendingInvitations(Long projectId, String username) {
        Project project = requireProject(projectId);
        projectAccessGuard.assertCan(requireUser(username), project.getId(), Resource.MEMBER, Action.CREATE);
        return new PendingInvitationCountResponse(
                projectMemberRepository.countByProjectIdAndStatus(project.getId(), "PENDING"));
    }

    static final int INVITABLE_MAX_RESULTS = 20;

    // Type-ahead for the invite picker: searches every ACTIVE user in the org
    // (not only the caller's co-members) by username or full name, excluding
    // the caller and anyone already ACTIVE/PENDING on this project. Filtering
    // and the result cap happen in the database query. Gated like inviting
    // itself — only someone who can invite to this project can browse for
    // people to invite.
    @Transactional(readOnly = true)
    public List<InvitableUserResponse> searchInvitableUsers(Long projectId, String query, int limit, String username) {
        User caller = requireUser(username);
        Project project = requireProject(projectId);
        projectAccessGuard.assertCan(caller, project.getId(), Resource.MEMBER, Action.CREATE);

        int size = Math.min(Math.max(limit, 1), INVITABLE_MAX_RESULTS);
        return userRepository
                .findInvitableUsers(project.getId(), caller.getId(), likePattern(query), PageRequest.of(0, size))
                .stream()
                .map(InvitableUserResponse::new)
                .toList();
    }

    // "%text%", lower-cased, with LIKE wildcards in the user's text escaped
    // ('!' is the ESCAPE character in UserRepository.findInvitableUsers) so
    // typing "%" or "_" matches those literal characters, not everyone.
    static String likePattern(String query) {
        String text = query == null ? "" : query.trim().toLowerCase();
        String escaped = text.replace("!", "!!").replace("%", "!%").replace("_", "!_");
        return "%" + escaped + "%";
    }

    // INACTIVE/SUSPENDED accounts can't sign in, so they can't act on an
    // invitation or work in a project — keep them off every team.
    private void assertEligibleForTeam(User target) {
        if (!"ACTIVE".equals(target.getAccountStatus())) {
            throw new IllegalArgumentException(
                    target.getUsername() + " has an inactive account and can't be added to a project");
        }
    }

    // Only OWNER/ADMIN of the project (or a system ADMINISTRATOR) may invite
    // a user to it. Re-invites a previously DECLINED row rather than
    // creating a second one — the (project_id, user_id) UNIQUE constraint
    // means there can only ever be one.
    public ProjectMemberResponse inviteMember(TeamInviteRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        Project project = requireProject(request.getProjectId());
        projectAccessGuard.assertCan(caller, project.getId(), Resource.MEMBER, Action.CREATE);

        User target = userRepository.findByUsernameIgnoreCase(request.getUsername())
                .orElseThrow(() -> new NotFoundException("No user found with that username"));
        if (target.getId().equals(caller.getId())) {
            throw new IllegalArgumentException("You cannot invite yourself");
        }
        assertEligibleForTeam(target);

        String invitedRole = request.getProjectRole() != null ? request.getProjectRole() : "MEMBER";
        assertNotOwnerRole(invitedRole);

        Optional<ProjectMember> existing = projectMemberRepository.findByProjectIdAndUserId(project.getId(), target.getId());
        ProjectMember member;
        if (existing.isPresent()) {
            member = existing.get();
            if ("ACTIVE".equals(member.getStatus())) {
                throw new IllegalArgumentException(target.getUsername() + " is already a member of this team");
            }
            if ("PENDING".equals(member.getStatus())) {
                throw new IllegalArgumentException("An invitation is already pending for " + target.getUsername());
            }
            member.setStatus("PENDING");
            member.setProjectRole(invitedRole);
            member.setInvitedBy(caller);
            member.setRespondedAt(null);
        } else {
            member = new ProjectMember();
            member.setProject(project);
            member.setUser(target);
            member.setProjectRole(invitedRole);
            member.setStatus("PENDING");
            member.setInvitedBy(caller);
        }

        ProjectMember saved = projectMemberRepository.save(member);
        notificationService.notifyTeamInvitation(saved, caller);
        return new ProjectMemberResponse(saved);
    }

    // The invited user accepting/declining their own pending invitation.
    public ProjectMemberResponse respondToInvitation(Long projectId, String username, boolean accept) {
        User caller = requireUser(username);
        ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(projectId, caller.getId())
                .orElseThrow(() -> new NotFoundException("No invitation found"));
        if (!"PENDING".equals(member.getStatus())) {
            throw new IllegalArgumentException("This invitation is no longer pending");
        }

        member.setStatus(accept ? "ACTIVE" : "DECLINED");
        member.setRespondedAt(OffsetDateTime.now());
        ProjectMember saved = projectMemberRepository.save(member);

        if (member.getInvitedBy() != null) {
            notificationService.notifyInvitationResponded(saved, accept);
        }
        return new ProjectMemberResponse(saved);
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Project requireProject(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    // Requires OWNER/ADMIN (or system ADMINISTRATOR) of the target project;
    // granting OWNER specifically requires being OWNER (or ADMINISTRATOR) —
    // an ADMIN may add MEMBER/VIEWER members but can't promote themselves or
    // anyone else to OWNER.
    public ProjectMemberResponse createProjectMember(ProjectMemberRequest request, String username) {
        User caller = requireUser(username);
        projectAccessGuard.assertCan(caller, request.getProjectId(), Resource.MEMBER, Action.CREATE);
        assertNotOwnerRole(request.getProjectRole());
        ProjectMember projectMember = new ProjectMember();
        applyRequest(projectMember, request);
        assertEligibleForTeam(projectMember.getUser());
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public ProjectMemberResponse updateProjectMember(Long id, ProjectMemberRequest request, String username) {
        User caller = requireUser(username);
        ProjectMember projectMember = getProjectMemberEntityById(id);
        projectAccessGuard.assertCan(caller, projectMember.getProject().getId(), Resource.MEMBER, Action.EDIT);
        // A membership row can have its ROLE changed, but not be re-pointed
        // at a different project or user — that would let a manager of one
        // project write into another, or hand someone else's membership to a
        // different person. To move someone, remove the row and add a new one.
        if (!projectMember.getProject().getId().equals(request.getProjectId())
                || !projectMember.getUser().getId().equals(request.getUserId())) {
            throw new IllegalArgumentException(
                    "A membership's project and user cannot be changed — remove it and add a new one");
        }
        boolean isOwner = "OWNER".equals(projectMember.getProjectRole()) && "ACTIVE".equals(projectMember.getStatus());
        if ("OWNER".equals(request.getProjectRole()) && !isOwner) {
            // Making someone the owner IS the transfer of ownership: the previous
            // owner becomes Team Leader in the same step. Needs PROJECT:ASSIGN
            // (the owner or an administrator); the new owner must be an active
            // member who can own projects (Project Manager or Administrator).
            projectAccessGuard.assertCan(caller, projectMember.getProject().getId(), Resource.PROJECT, Action.ASSIGN);
            return new ProjectMemberResponse(projectOwnership.transfer(projectMember.getProject(), projectMember));
        }
        String effectiveNewRole = request.getProjectRole() != null ? request.getProjectRole() : projectMember.getProjectRole();
        assertNotRemovingLastOwner(projectMember, effectiveNewRole);
        applyRequest(projectMember, request);
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public void deleteProjectMember(Long id, String username) {
        ProjectMember projectMember = getProjectMemberEntityById(id);
        projectAccessGuard.assertCan(requireUser(username), projectMember.getProject().getId(), Resource.MEMBER, Action.DELETE);
        assertNotRemovingLastOwner(projectMember, null);
        projectMemberRepository.delete(projectMember);
    }

    // A project always has exactly one ACTIVE owner. The owner's membership can
    // therefore not be demoted or removed directly: ownership is TRANSFERRED to
    // another member first (updateProjectMember with role OWNER), which demotes
    // the previous owner in the same step. Applies unconditionally, even to a
    // system ADMINISTRATOR - it is a data invariant, not a permission gate
    // (backed by trg_project_members_single_owner in the database).
    private void assertNotRemovingLastOwner(ProjectMember member, String newRole) {
        boolean wasActiveOwner = "OWNER".equals(member.getProjectRole()) && "ACTIVE".equals(member.getStatus());
        if (!wasActiveOwner || "OWNER".equals(newRole)) {
            return;
        }
        throw new IllegalArgumentException(
                "This is the project's owner. Transfer ownership to another member before changing or removing this membership");
    }

    private void applyRequest(ProjectMember projectMember, ProjectMemberRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new NotFoundException("Project not found"));
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found"));

        projectMember.setProject(project);
        projectMember.setUser(user);
        if (request.getProjectRole() != null) {
            projectMember.setProjectRole(request.getProjectRole());
        }
    }
}
