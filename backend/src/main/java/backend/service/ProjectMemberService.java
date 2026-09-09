package backend.service;

import backend.dto.ProjectMemberRequest;
import backend.dto.ProjectMemberResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public ProjectMemberService(
            ProjectMemberRepository projectMemberRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository) {
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getAllProjectMembers() {
        return projectMemberRepository.findAll()
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectMemberResponse getProjectMemberById(Long id) {
        return new ProjectMemberResponse(getProjectMemberEntityById(id));
    }

    @Transactional(readOnly = true)
    public ProjectMember getProjectMemberEntityById(Long id) {
        return projectMemberRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Project member not found"));
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getMembersByProjectId(Long projectId) {
        return projectMemberRepository.findByProjectId(projectId)
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectMemberResponse> getProjectsByUserId(Long userId) {
        return projectMemberRepository.findByUserId(userId)
                .stream()
                .map(ProjectMemberResponse::new)
                .toList();
    }

    public ProjectMemberResponse createProjectMember(ProjectMemberRequest request) {
        ProjectMember projectMember = new ProjectMember();
        applyRequest(projectMember, request);
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public ProjectMemberResponse updateProjectMember(Long id, ProjectMemberRequest request) {
        ProjectMember projectMember = getProjectMemberEntityById(id);
        applyRequest(projectMember, request);
        return new ProjectMemberResponse(projectMemberRepository.save(projectMember));
    }

    public void deleteProjectMember(Long id) {
        ProjectMember projectMember = getProjectMemberEntityById(id);
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
