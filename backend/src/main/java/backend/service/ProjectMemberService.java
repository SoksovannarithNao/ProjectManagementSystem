package backend.service;

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

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            NotificationService notificationService) {
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.notificationService = notificationService;
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

    // Directory-style lookup ("which projects is this member on") — kept
    // open like GET /api/users, matching the Team page's existing use of it
    // to show any member's project involvement, not just the caller's own.
    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getProjectsByUserId(Long userId) {
        return projectMemberRepository.findByUserId(userId)
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    // Team-Admin-only: invitations sent for a project, awaiting a response.
    public List<ProjectMemberResponse> getPendingInvitations(Long projectId, String username) {
        Project project = requireProject(projectId);
        projectAccessGuard.assertCanManage(requireUser(username), project.getId());
        return projectMemberRepository.findByProjectIdAndStatus(projectId, "PENDING")
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    // Only OWNER/ADMIN of the project (or a system ADMINISTRATOR) may invite
    // a user to it. Re-invites a previously DECLINED row rather than
    // creating a second one — the (project_id, user_id) UNIQUE constraint
    // means there can only ever be one.
    public ProjectMemberResponse inviteMember(TeamInviteRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        Project project = requireProject(request.getProjectId());
        projectAccessGuard.assertCanManage(caller, project.getId());

        User target = userRepository.findByUsernameIgnoreCase(request.getUsername())
                .orElseThrow(() -> new NotFoundException("No user found with that username"));
        if (target.getId().equals(caller.getId())) {
            throw new IllegalArgumentException("You cannot invite yourself");
        }

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
            member.setInvitedBy(caller);
            member.setRespondedAt(null);
        } else {
            member = new ProjectMember();
            member.setProject(project);
            member.setUser(target);
            member.setProjectRole("MEMBER");
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
        projectAccessGuard.assertCanManage(caller, request.getProjectId());
        if ("OWNER".equals(request.getProjectRole())) {
            projectAccessGuard.assertIsOwner(caller, request.getProjectId());
        }
        ProjectMember projectMember = new ProjectMember();
        applyRequest(projectMember, request);
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public ProjectMemberResponse updateProjectMember(Long id, ProjectMemberRequest request, String username) {
        User caller = requireUser(username);
        ProjectMember projectMember = getProjectMemberEntityById(id);
        projectAccessGuard.assertCanManage(caller, projectMember.getProject().getId());
        if ("OWNER".equals(request.getProjectRole())) {
            projectAccessGuard.assertIsOwner(caller, projectMember.getProject().getId());
        }
        applyRequest(projectMember, request);
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public void deleteProjectMember(Long id, String username) {
        ProjectMember projectMember = getProjectMemberEntityById(id);
        projectAccessGuard.assertCanManage(requireUser(username), projectMember.getProject().getId());
        projectMemberRepository.delete(projectMember);
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
