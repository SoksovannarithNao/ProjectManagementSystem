package backend.service;

import backend.entity.ProjectMember;
import backend.repository.ProjectMemberRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ProjectMemberService {

    private final ProjectMemberRepository projectMemberRepository;

    public ProjectMemberService(ProjectMemberRepository projectMemberRepository) {
        this.projectMemberRepository = projectMemberRepository;
    }

    public List<ProjectMember> getAllProjectMembers() {
        return projectMemberRepository.findAll();
    }

    public ProjectMember getProjectMemberById(Long id) {
        return projectMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project member not found"));
    }

    public List<ProjectMember> getMembersByProjectId(Long projectId) {
        return projectMemberRepository.findByProjectId(projectId);
    }

    public List<ProjectMember> getProjectsByUserId(Long userId) {
        return projectMemberRepository.findByUserId(userId);
    }

    public ProjectMember createProjectMember(ProjectMember projectMember) {
        return projectMemberRepository.save(projectMember);
    }

    public ProjectMember updateProjectMember(Long id, ProjectMember memberDetails) {
        ProjectMember projectMember = getProjectMemberById(id);

        projectMember.setProject(memberDetails.getProject());
        projectMember.setUser(memberDetails.getUser());
        projectMember.setProjectRole(memberDetails.getProjectRole());

        return projectMemberRepository.save(projectMember);
    }

    public void deleteProjectMember(Long id) {
        ProjectMember projectMember = getProjectMemberById(id);
        projectMemberRepository.delete(projectMember);
    }
}