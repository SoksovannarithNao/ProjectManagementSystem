package backend.service;

import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Scoped by project membership (Role_Requirment.md / Project_requirement_plan.md
    // §28) — ADMINISTRATOR sees every project; everyone else only sees
    // projects they're a member of. createProject/updateProject below always
    // add the designated manager as a project_member, so a Project Manager
    // still sees the projects they manage.
    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<Project> projects;
        if (projectAccessGuard.isAdmin(caller)) {
            projects = projectRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            projects = projectRepository.findByIdIn(visibleProjectIds);
        }

        return projects.stream().map(ProjectResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectById(Long id, String username) {
        Project project = getProjectEntityById(id);
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
        projectAccessGuard.assertAccess(caller, project.getId());
        return new ProjectResponse(project);
    }

    @Transactional(readOnly = true)
    public Project getProjectEntityById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    // Any authenticated user may create a project — that's the whole point
    // of project-scoped authorization: you don't need a global role to own
    // your own project. The caller always becomes the manager/OWNER unless
    // they're a system ADMINISTRATOR explicitly assigning someone else (the
    // one pre-existing capability this preserves — e.g. an admin setting up
    // a project on another user's behalf).
    public ProjectResponse createProject(ProjectRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        Project project = new Project();
        applyRequest(project, request, caller);
        Project saved = projectRepository.save(project);
        ensureManagerIsMember(saved);
        return new ProjectResponse(saved);
    }

    public ProjectResponse updateProject(Long id, ProjectRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        projectAccessGuard.assertCanManage(caller, id);
        Project project = getProjectEntityById(id);
        applyRequest(project, request, caller);
        Project saved = projectRepository.save(project);
        ensureManagerIsMember(saved);
        return new ProjectResponse(saved);
    }

    // getAllProjects/getAllTasks scope non-admins to projects they're a
    // project_member of, so the manager must always be one — otherwise
    // whoever's responsible for a project couldn't see it. Matches how
    // database/init/02-seed.sql seeds every project's manager as a
    // project_member with that same role. Only used for a brand-new
    // membership row (createProject) or when an ADMINISTRATOR reassigns the
    // manager on updateProject — never downgrades an existing OWNER/ADMIN's
    // role.
    private void ensureManagerIsMember(Project project) {
        Long managerId = project.getManager().getId();
        if (projectMemberRepository.existsByProjectIdAndUserId(project.getId(), managerId)) {
            return;
        }
        ProjectMember member = new ProjectMember();
        member.setProject(project);
        member.setUser(project.getManager());
        member.setProjectRole("OWNER");
        projectMemberRepository.save(member);
    }

    // OWNER-only (or system ADMINISTRATOR) — matches ADMIN's project-level
    // permissions excluding delete/transfer-ownership.
    public void deleteProject(Long id, String callerUsername) {
        User caller = requireUser(callerUsername);
        projectAccessGuard.assertIsOwner(caller, id);
        Project project = getProjectEntityById(id);
        projectRepository.delete(project);
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    // On create (project.getManager() is still null), the caller becomes
    // the manager. On update, the existing manager is kept. Either way, a
    // system ADMINISTRATOR may override by explicitly naming someone else
    // via request.managerId — the one pre-existing capability this
    // preserves; a non-admin caller's managerId (if the frontend even sends
    // one) is ignored.
    private void applyRequest(Project project, ProjectRequest request, User caller) {
        User defaultManager = project.getManager() != null ? project.getManager() : caller;
        User manager = defaultManager;
        if (request.getManagerId() != null
                && !request.getManagerId().equals(defaultManager.getId())
                && projectAccessGuard.isAdmin(caller)) {
            manager = userRepository.findById(request.getManagerId())
                    .orElseThrow(() -> new NotFoundException("Manager (user) not found"));
        }

        project.setProjectCode(request.getProjectCode());
        project.setName(request.getName());
        project.setDescription(request.getDescription());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setManager(manager);
        if (request.getPriority() != null) {
            project.setPriority(request.getPriority());
        }
        if (request.getStatus() != null) {
            project.setStatus(request.getStatus());
        }
        if (request.getProgress() != null) {
            project.setProgress(request.getProgress());
        } else if (project.getProgress() == null) {
            project.setProgress(BigDecimal.ZERO);
        }
    }
}
