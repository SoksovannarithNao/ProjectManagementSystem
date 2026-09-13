package backend.service;

import backend.dto.MilestoneRequest;
import backend.dto.MilestoneResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public MilestoneService(
            MilestoneRepository milestoneRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.milestoneRepository = milestoneRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Previously an unscoped findAll() with no username parameter at all —
    // any authenticated user (including a brand-new one with zero project
    // memberships) could see every milestone in the system. Scoped the same
    // way as TaskService.getAllTasks.
    @Transactional(readOnly = true)
    public List<MilestoneResponse> getAllMilestones(String username) {
        User caller = requireUser(username);
        List<Milestone> milestones;
        if (projectAccessGuard.isAdmin(caller)) {
            milestones = milestoneRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            milestones = milestoneRepository.findAll().stream()
                    .filter(m -> visibleProjectIds.contains(m.getProject().getId()))
                    .toList();
        }
        return milestones.stream().map(MilestoneResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public MilestoneResponse getMilestoneById(Long id, String username) {
        Milestone milestone = getMilestoneEntityById(id);
        projectAccessGuard.assertAccess(requireUser(username), milestone.getProject().getId());
        return new MilestoneResponse(milestone);
    }

    @Transactional(readOnly = true)
    public Milestone getMilestoneEntityById(Long id) {
        return milestoneRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Milestone not found"));
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponse> getMilestonesByProjectId(Long projectId, String username) {
        projectAccessGuard.assertAccess(requireUser(username), projectId);
        return milestoneRepository.findByProjectId(projectId)
                .stream()
                .map(MilestoneResponse::new)
                .toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public MilestoneResponse createMilestone(MilestoneRequest request) {
        Milestone milestone = new Milestone();
        applyRequest(milestone, request);
        return new MilestoneResponse(milestoneRepository.save(milestone));
    }

    public MilestoneResponse updateMilestone(Long id, MilestoneRequest request) {
        Milestone milestone = getMilestoneEntityById(id);
        applyRequest(milestone, request);
        return new MilestoneResponse(milestoneRepository.save(milestone));
    }

    public void deleteMilestone(Long id) {
        Milestone milestone = getMilestoneEntityById(id);
        milestoneRepository.delete(milestone);
    }

    private void applyRequest(Milestone milestone, MilestoneRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new NotFoundException("Project not found"));

        milestone.setProject(project);
        milestone.setTitle(request.getTitle());
        milestone.setDescription(request.getDescription());
        milestone.setDueDate(request.getDueDate());
        if (request.getStatus() != null) {
            milestone.setStatus(request.getStatus());
        }
        if (request.getProgress() != null) {
            milestone.setProgress(request.getProgress());
        } else if (milestone.getProgress() == null) {
            milestone.setProgress(BigDecimal.ZERO);
        }
    }
}
