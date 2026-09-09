package backend.service;

import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.entity.Project;
import backend.entity.User;
import backend.exception.NotFoundException;
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
    private final UserRepository userRepository;

    public ProjectService(ProjectRepository projectRepository, UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> getAllProjects() {
        return projectRepository.findAll()
                .stream()
                .map(ProjectResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProjectById(Long id) {
        return new ProjectResponse(getProjectEntityById(id));
    }

    @Transactional(readOnly = true)
    public Project getProjectEntityById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    public ProjectResponse createProject(ProjectRequest request) {
        Project project = new Project();
        applyRequest(project, request);
        return new ProjectResponse(projectRepository.save(project));
    }

    public ProjectResponse updateProject(Long id, ProjectRequest request) {
        Project project = getProjectEntityById(id);
        applyRequest(project, request);
        return new ProjectResponse(projectRepository.save(project));
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
