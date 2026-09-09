package backend.service;

import backend.dto.MilestoneRequest;
import backend.dto.MilestoneResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.exception.NotFoundException;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final ProjectRepository projectRepository;

    public MilestoneService(MilestoneRepository milestoneRepository, ProjectRepository projectRepository) {
        this.milestoneRepository = milestoneRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponse> getAllMilestones() {
        return milestoneRepository.findAll()
                .stream()
                .map(MilestoneResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public MilestoneResponse getMilestoneById(Long id) {
        return new MilestoneResponse(getMilestoneEntityById(id));
    }

    @Transactional(readOnly = true)
    public Milestone getMilestoneEntityById(Long id) {
        return milestoneRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Milestone not found"));
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponse> getMilestonesByProjectId(Long projectId) {
        return milestoneRepository.findByProjectId(projectId)
                .stream()
                .map(MilestoneResponse::new)
                .toList();
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
