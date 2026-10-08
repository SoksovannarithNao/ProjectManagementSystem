package backend.service;

import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.ConflictException;
import backend.exception.GlobalExceptionHandler;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
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
    private final ProjectOwnership projectOwnership;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ProjectOwnership projectOwnership) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.projectOwnership = projectOwnership;
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

    // Creating a project needs the project-creation capability (PROJECT:CREATE:
    // Project Manager and Administrator). The caller becomes the project's single
    // OWNER and manager, unless an ADMINISTRATOR names someone else who is able to
    // own projects (D-03) - e.g. setting up a project on another person's behalf.
    public ProjectResponse createProject(ProjectRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        // Creating a project is not about any one project yet, so it is a SYSTEM
        // permission (PROJECT:CREATE): Project Manager and Administrator.
        projectAccessGuard.assertSystemCan(caller, Resource.PROJECT, Action.CREATE);
        Project project = new Project();
        applyRequest(project, request, caller);
        Project saved = projectRepository.save(project);
        projectOwnership.assignOwner(saved, saved.getManager());
        return new ProjectResponse(saved);
    }

    public ProjectResponse updateProject(Long id, ProjectRequest request, String callerUsername) {
        User caller = requireUser(callerUsername);
        projectAccessGuard.assertCan(caller, id, Resource.PROJECT, Action.EDIT);
        Project project = getProjectEntityById(id);
        applyRequest(project, request, caller);
        Project saved = projectRepository.save(project);
        // Only an administrator can change the manager; that is an ownership transfer.
        projectOwnership.assignOwner(saved, saved.getManager());
        return new ProjectResponse(saved);
    }

    // OWNER-only (or system ADMINISTRATOR) — matches ADMIN's project-level
    // permissions excluding delete/transfer-ownership.
    public void deleteProject(Long id, String callerUsername) {
        User caller = requireUser(callerUsername);
        projectAccessGuard.assertCan(caller, id, Resource.PROJECT, Action.DELETE);
        Project project = getProjectEntityById(id);
        projectRepository.delete(project);
    }

    // Next PRJ-#### after the highest one in use (seed data starts at
    // PRJ-2001, so the first generated code is PRJ-2004). The unique
    // constraint on project_code remains the backstop for two simultaneous
    // creates picking the same number.
    private String generateProjectCode() {
        int max = 0;
        for (String code : projectRepository.findAutoProjectCodes()) {
            String digits = code.substring("PRJ-".length());
            if (digits.matches("\\d{1,9}")) {
                max = Math.max(max, Integer.parseInt(digits));
            }
        }
        return String.format("PRJ-%04d", max + 1);
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

        if (request.getProjectCode() != null && !request.getProjectCode().isBlank()) {
            String code = request.getProjectCode().trim();
            // Friendly 409 up front; the DB unique constraint stays as the
            // backstop (see GlobalExceptionHandler for the racing case).
            boolean taken = project.getId() == null
                    ? projectRepository.existsByProjectCode(code)
                    : projectRepository.existsByProjectCodeAndIdNot(code, project.getId());
            if (taken) {
                throw new ConflictException(GlobalExceptionHandler.PROJECT_CODE_EXISTS_MESSAGE);
            }
            project.setProjectCode(code);
        } else if (project.getProjectCode() == null) {
            project.setProjectCode(generateProjectCode());
        }
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
