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
        if ("ADMINISTRATOR".equals(caller.getRole().getName())) {
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

    public ProjectResponse createProject(ProjectRequest request) {
        Project project = new Project();
        applyRequest(project, request);
        Project saved = projectRepository.save(project);
        ensureManagerIsMember(saved);
        return new ProjectResponse(saved);
    }

    public ProjectResponse updateProject(Long id, ProjectRequest request) {
        Project project = getProjectEntityById(id);
        applyRequest(project, request);
        Project saved = projectRepository.save(project);
        ensureManagerIsMember(saved);
        return new ProjectResponse(saved);
    }

    // getAllProjects/getAllTasks scope non-admins to projects they're a
    // project_member of, so the manager must always be one — otherwise a
    // Project Manager couldn't see a project (or reassigned-to-them project)
    // they were just made responsible for. Matches how database/init/02-seed.sql
    // seeds every project's manager as a project_member with that same role.
    private void ensureManagerIsMember(Project project) {
        Long managerId = project.getManager().getId();
        if (projectMemberRepository.existsByProjectIdAndUserId(project.getId(), managerId)) {
            return;
        }
        ProjectMember member = new ProjectMember();
        member.setProject(project);
        member.setUser(project.getManager());
        member.setProjectRole("PROJECT_MANAGER");
        projectMemberRepository.save(member);
    }

    public void deleteProject(Long id) {
        Project project = getProjectEntityById(id);
        projectRepository.delete(project);
    }

    private void applyRequest(Project project, ProjectRequest request) {
        User manager = userRepository.findById(request.getManagerId())
                .orElseThrow(() -> new NotFoundException("Manager (user) not found"));

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
